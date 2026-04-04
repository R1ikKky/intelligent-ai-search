import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ required: false })
  customerDataId?: string;
}
