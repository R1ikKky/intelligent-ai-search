import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'buyer', enum: ['buyer', 'admin'] })
  @IsString()
  @IsNotEmpty()
  role!: string;
}
