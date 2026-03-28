import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  login(dto: LoginDto): TokenResponseDto {
    const payload = { sub: dto.userId, userId: dto.userId, role: dto.role };
    const token = this.jwtService.sign(payload);
    return { accessToken: token, userId: dto.userId, role: dto.role };
  }
}
