import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Mock login — returns JWT for testing' })
  @ApiResponse({ status: 201, type: TokenResponseDto })
  login(@Body() dto: LoginDto): TokenResponseDto {
    return this.authService.login(dto);
  }
}
