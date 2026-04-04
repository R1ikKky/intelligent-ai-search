import { ApiProperty } from '@nestjs/swagger';
import { SearchResultItemDto } from '../../products/dto/product.dto';

export class BootstrapResponseDto {
  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerDataId!: string;

  @ApiProperty()
  seedSource!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  coldStartSeedCategories!: Record<string, number>;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  coldStartSeedManufacturers!: Record<string, number>;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  coldStartSeedSuppliers!: Record<string, number>;

  @ApiProperty({ type: [SearchResultItemDto] })
  suggestedProducts!: SearchResultItemDto[];
}
