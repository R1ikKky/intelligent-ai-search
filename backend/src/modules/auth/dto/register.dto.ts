import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '7701234567', description: 'ИНН заказчика (10 или 12 цифр)' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 12)
  @Matches(/^\d+$/, { message: 'ИНН должен содержать только цифры' })
  inn!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'ООО Ромашка', description: 'Название организации' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  orgName!: string;

  @ApiProperty({ example: 'Москва', description: 'Регион / город заказчика' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  location!: string;
}
