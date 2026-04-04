import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { Customer, CustomerStatus } from './entities/customer.entity';
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
    try {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const customer = await this.customerRepo.save(
        this.customerRepo.create({
          login: dto.inn,
          passwordHash,
          orgName: dto.orgName,
          location: dto.location,
          status: CustomerStatus.ACTIVE,
        }),
      );
      return this.issueSession(customer, req, res);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Учётная запись с таким ИНН уже существует');
      }
      throw err;
    }
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
    if (customer.status !== CustomerStatus.ACTIVE) {
      throw new UnauthorizedException('Учётная запись заблокирована');
    }

    const passwordMatch = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Неверный ИНН или пароль');
    }

    const [tokenResponse] = await Promise.all([
      this.issueSession(customer, req, res),
      this.customerRepo.update(customer.id, { lastLoginAt: new Date() }),
    ]);
    return tokenResponse;
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
        res.clearCookie(REFRESH_COOKIE);
        throw new UnauthorizedException('Refresh token недействителен или истёк');
      }

      await qr.manager.delete(RefreshToken, { id: stored.id });

      const newRefresh = this.signToken(stored.customerId, 'refresh');
      const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);
      const newToken = qr.manager.create(RefreshToken, {
        token: newRefresh,
        customerId: stored.customerId,
        ...this.extractClientMeta(req),
        expiresAt,
      });
      await qr.manager.save(RefreshToken, newToken);

      await qr.commitTransaction();

      this.setRefreshCookie(res, newRefresh);
      const accessToken = this.signToken(stored.customerId, 'access');
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
    const accessToken = this.signToken(customer.id, 'access');
    const refreshToken = this.signToken(customer.id, 'refresh');
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        token: refreshToken,
        customerId: customer.id,
        ...this.extractClientMeta(req),
        expiresAt,
      }),
    );

    this.setRefreshCookie(res, refreshToken);

    return { accessToken, customerId: customer.id, login: customer.login };
  }

  private signToken(customerId: string, type: 'access' | 'refresh'): string {
    return this.jwtService.sign(
      { sub: customerId },
      {
        secret: this.configService.get<string>(`jwt.${type}Secret`),
        expiresIn: this.configService.get<string>(`jwt.${type}ExpiresIn`) ?? (type === 'access' ? '15m' : '30d'),
      },
    );
  }

  private extractClientMeta(req: Request): { userAgent: string | null; ip: string | null } {
    return {
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 200) || null,
      ip: (req.ip ?? '').slice(0, 45) || null,
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: REFRESH_EXPIRES_MS,
    });
  }
}
