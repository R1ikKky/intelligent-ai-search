import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerData } from '../../domain/entities/customer-data.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerData, RefreshToken]),
    ProfileModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret') ?? 'access-secret',
        signOptions: {
          expiresIn: (config.get<string>('jwt.accessExpiresIn') ?? '15m') as
            | `${number}${'s' | 'm' | 'h' | 'd'}`
            | undefined,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule, JwtStrategy, AuthService],
})
export class AuthModule {}
