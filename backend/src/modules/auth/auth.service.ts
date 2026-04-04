import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerData } from '../../domain/entities/customer-data.entity';
import { ProfileService } from '../profile/profile.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerData)
    private readonly customerDataRepo: Repository<CustomerData>,
    private readonly profileService: ProfileService,
  ) {}

  private buildTokenResponse(
    customer: Customer,
    token: string,
  ): TokenResponseDto {
    return {
      accessToken: token,
      userId: customer.id,
      role: 'buyer',
      customerDataId: customer.customerDataId,
    };
  }

  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    const inn = dto.customer_inn;
    const existing = await this.customerRepo.findOne({ where: { login: inn } });
    if (existing) {
      throw new ConflictException('User with this INN already registered');
    }

    let data = await this.customerDataRepo.findOne({ where: { id: inn } });
    const now = new Date();
    if (!data) {
      data = this.customerDataRepo.create({
        id: inn,
        customerName: `Заказчик ИНН ${inn}`,
        customerNameNormalized: inn,
        customerRegion: '',
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

    const token = this.jwtService.sign({
      sub: customer.id,
      userId: customer.id,
      customerDataId: customer.customerDataId,
      role: 'buyer',
    });
    return this.buildTokenResponse(customer, token);
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const customer = await this.customerRepo.findOne({ where: { login: dto.customer_inn } });
    if (!customer) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await argon2.verify(customer.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    customer.lastLoginAt = new Date();
    await this.customerRepo.save(customer);
    await this.profileService.syncColdStartFromOrg(customer.id, customer.customerDataId);

    const token = this.jwtService.sign({
      sub: customer.id,
      userId: customer.id,
      customerDataId: customer.customerDataId,
      role: 'buyer',
    });
    return this.buildTokenResponse(customer, token);
  }
}
