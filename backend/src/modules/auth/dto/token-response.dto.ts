import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ description: 'JWT access token (15 минут)' })
  accessToken!: string;

  @ApiProperty({ description: 'UUID учётной записи' })
  customerId!: string;

  @ApiProperty({ example: '7701234567', description: 'ИНН (login)' })
  login!: string;
}
