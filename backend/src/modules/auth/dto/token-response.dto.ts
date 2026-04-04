import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'UUID учётной записи (customer.id)' })
  customerId!: string;

  @ApiProperty({ example: '7701234567', description: 'ИНН (login)' })
  login!: string;

  @ApiProperty({ example: 'buyer' })
  role!: string;

  @ApiProperty({ required: false, description: 'ИНН организации в customer_data (ключ ETL)' })
  customerDataId?: string;
}
