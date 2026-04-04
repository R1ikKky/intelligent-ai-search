import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '7701234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}(\d{2})?$/, { message: 'customer_inn must be 10 or 12 digits' })
  customer_inn!: string;

  @ApiProperty({ example: 'StrongPassword123!', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
