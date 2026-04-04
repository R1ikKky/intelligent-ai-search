import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

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

  @ApiPropertyOptional({
    example: 'ООО Ромашка',
    description: 'Название организации (если нет строки в customer_data после ETL)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  orgName?: string;

  @ApiPropertyOptional({
    example: 'Москва',
    description: 'Регион / город (если нет в customer_data)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;
}
