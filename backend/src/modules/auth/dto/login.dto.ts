import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '7701234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}(\d{2})?$/, { message: 'customer_inn must be 10 or 12 digits' })
  customer_inn!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}
