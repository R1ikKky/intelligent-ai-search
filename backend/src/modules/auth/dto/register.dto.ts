import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '7701234567', description: 'ИНН заказчика (10 или 12 цифр)' })
  @IsString()
  @Length(10, 12)
  inn!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
