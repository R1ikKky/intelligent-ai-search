import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '7701234567', description: 'ИНН заказчика (10 или 12 цифр)' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 12)
  @Matches(/^\d+$/, { message: 'ИНН должен содержать только цифры' })
  inn!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
