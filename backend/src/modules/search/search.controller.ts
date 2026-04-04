import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuggestQueryDto, SuggestResponseDto } from './dto/suggest.dto';
import { SuggestService } from './suggest.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly suggestService: SuggestService) {}

  @Post('suggest')
  @ApiOperation({ summary: 'Autocomplete suggestions with spellfix + synonyms (spec §16.3)' })
  @ApiResponse({ status: 201, type: SuggestResponseDto })
  suggest(@Body() dto: SuggestQueryDto): Promise<SuggestResponseDto> {
    return this.suggestService.suggest(dto);
  }
}
