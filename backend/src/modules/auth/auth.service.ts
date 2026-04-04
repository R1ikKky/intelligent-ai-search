import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { Customer } from './entities/customer.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenResponseDto } from './dto/token-response.dto';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    req: Request,
    res: Response,
  ): Promise<TokenResponseDto> {
    const existing = await this.customerRepo.findOne({
      where: { login: dto.inn },
    });
    if (existing) {
      throw new ConflictException('Учётная запись с таким ИНН уже существует');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const customer = this.customerRepo.create({
      login: dto.inn,
      passwordHash,
      status: 'active',
    });
    await this.customerRepo.save(customer);

    return this.issueSession(customer, req, res);
  }

  async login(
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<TokenResponseDto> {
    const customer = await this.customerRepo.findOne({
      where: { login: dto.inn },
    });
    if (!customer) {
      throw new UnauthorizedException('Неверный ИНН или пароль');
    }
    if (customer.status !== 'active') {
      throw new UnauthorizedException('Учётная запись заблокирована');
    }

    const passwordMatch = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Неверный ИНН или пароль');
    }

    await this.customerRepo.update(customer.id, { lastLoginAt: new Date() });

    return this.issueSession(customer, req, res);
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const token: string | undefined = (req.cookies as Record<string, string>)[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Refresh token отсутствует');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const stored = await qr.manager.findOne(RefreshToken, {
        where: { token },
      });
      if (!stored || stored.expiresAt < new Date()) {
        await qr.rollbackTransaction();
        res.clearCookie(REFRESH_COOKIE);
        throw new UnauthorizedException('Refresh token недействителен или истёк');
      }

      await qr.manager.delete(RefreshToken, { id: stored.id });

      const newRefresh = this.signRefresh(stored.customerId);
      const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);
      const newToken = qr.manager.create(RefreshToken, {
        token: newRefresh,
        customerId: stored.customerId,
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 200) || null,
        ip: (req.ip ?? '').slice(0, 45) || null,
        expiresAt,
      });
      await qr.manager.save(RefreshToken, newToken);

      await qr.commitTransaction();

      this.setRefreshCookie(res, newRefresh);
      const accessToken = this.signAccess(stored.customerId);
      return { accessToken };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    const token: string | undefined = (req.cookies as Record<string, string>)[REFRESH_COOKIE];
    if (token) {
      await this.refreshTokenRepo.delete({ token });
    }
    res.clearCookie(REFRESH_COOKIE);
  }

  private async issueSession(
    customer: Customer,
    req: Request,
    res: Response,
  ): Promise<TokenResponseDto> {
    const accessToken = this.signAccess(customer.id);
    const refreshToken = this.signRefresh(customer.id);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        token: refreshToken,
        customerId: customer.id,
        userAgent: (req.headers['user-agent'] ?? '').slice(0, 200) || null,
        ip: (req.ip ?? '').slice(0, 45) || null,
        expiresAt,
      }),
    );

    this.setRefreshCookie(res, refreshToken);

    return { accessToken, customerId: customer.id, login: customer.login };
  }

  private signAccess(customerId: string): string {
    return this.jwtService.sign(
      { sub: customerId, customerId },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn') ?? '15m',
      },
    );
  }

  private signRefresh(customerId: string): string {
    return this.jwtService.sign(
      { sub: customerId, customerId },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d',
      },
    );
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: REFRESH_EXPIRES_MS,
    });
  }
}
