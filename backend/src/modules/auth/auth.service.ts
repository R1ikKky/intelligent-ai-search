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
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerData } from '../../domain/entities/customer-data.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ProfileService } from '../profile/profile.service';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerData)
    private readonly customerDataRepo: Repository<CustomerData>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly profileService: ProfileService,
  ) {}

  private buildAccessPayload(customer: Customer) {
    return {
      sub: customer.id,
      userId: customer.id,
      customerDataId: customer.customerDataId,
      role: 'buyer',
    };
  }

  private signAccessToken(customer: Customer): string {
    const expiresIn = (this.configService.get<string>('jwt.accessExpiresIn') ?? '15m') as
      | `${number}${'s' | 'm' | 'h' | 'd'}`
      | undefined;
    return this.jwtService.sign(this.buildAccessPayload(customer), {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn,
    });
  }

  private signRefreshToken(customerId: string): string {
    const expiresIn = (this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d') as
      | `${number}${'s' | 'm' | 'h' | 'd'}`
      | undefined;
    return this.jwtService.sign(
      { sub: customerId },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn,
      },
    );
  }

  private buildTokenResponse(customer: Customer, accessToken: string): TokenResponseDto {
    return {
      accessToken,
      customerId: customer.id,
      login: customer.login,
      role: 'buyer',
      customerDataId: customer.customerDataId,
    };
  }

  async register(
    dto: RegisterDto,
    req: Request,
    res: Response,
  ): Promise<TokenResponseDto> {
    const inn = dto.inn;
    const existing = await this.customerRepo.findOne({ where: { login: inn } });
    if (existing) {
      throw new ConflictException('Учётная запись с таким ИНН уже существует');
    }

    let data = await this.customerDataRepo.findOne({ where: { id: inn } });
    const now = new Date();
    if (!data) {
      const name = dto.orgName?.trim() || `Заказчик ИНН ${inn}`;
      const region = dto.location?.trim() || '';
      data = this.customerDataRepo.create({
        id: inn,
        customerName: name,
        customerNameNormalized: inn,
        customerRegion: region,
        orgTypePrimary: null,
        orgTypeTags: [],
        nameVariants: {},
        sourceFirstSeenAt: now,
        sourceLastSeenAt: now,
      });
      await this.customerDataRepo.save(data);
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const customer = this.customerRepo.create({
      customerDataId: inn,
      login: inn,
      passwordHash,
      status: 'active',
    });
    await this.customerRepo.save(customer);

    await this.profileService.syncColdStartFromOrg(customer.id, customer.customerDataId);
    return this.issueSession(customer, req, res);
  }

  async login(
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<TokenResponseDto> {
    const customer = await this.customerRepo.findOne({ where: { login: dto.inn } });
    if (!customer) {
      throw new UnauthorizedException('Неверный ИНН или пароль');
    }
    if (customer.status !== 'active') {
      throw new UnauthorizedException('Учётная запись заблокирована');
    }

    const ok = await argon2.verify(customer.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Неверный ИНН или пароль');
    }

    customer.lastLoginAt = new Date();
    await this.customerRepo.save(customer);
    await this.profileService.syncColdStartFromOrg(customer.id, customer.customerDataId);

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
        res.clearCookie(REFRESH_COOKIE);
        throw new UnauthorizedException('Refresh token недействителен или истёк');
      }

      const customer = await qr.manager.findOne(Customer, {
        where: { id: stored.customerId },
      });
      if (!customer) {
        res.clearCookie(REFRESH_COOKIE);
        throw new UnauthorizedException('Пользователь не найден');
      }

      await qr.manager.delete(RefreshToken, { id: stored.id });

      const newRefresh = this.signRefreshToken(stored.customerId);
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
      const accessToken = this.signAccessToken(customer);
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
    const accessToken = this.signAccessToken(customer);
    const refreshToken = this.signRefreshToken(customer.id);
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
    return this.buildTokenResponse(customer, accessToken);
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
