import { ApiProperty } from '@nestjs/swagger';

/** Как в feature/backend: access в теле, refresh в httpOnly cookie. */
export class TokenResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'UUID учётной записи' })
  customerId!: string;

  @ApiProperty({ example: '7701234567', description: 'ИНН (login)' })
  login!: string;
}
