import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSynonymDto, SynonymGroupDto } from './dto/synonym.dto';
import { SynonymsService } from './synonyms.service';

@ApiTags('Synonyms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('synonyms')
export class SynonymsController {
  constructor(private readonly synonymsService: SynonymsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a synonym group' })
  @ApiResponse({ status: 201, type: SynonymGroupDto })
  create(@Body() dto: CreateSynonymDto): SynonymGroupDto {
    return this.synonymsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all synonym groups' })
  @ApiResponse({ status: 200, type: [SynonymGroupDto] })
  findAll(): SynonymGroupDto[] {
    return this.synonymsService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a synonym group' })
  @ApiResponse({ status: 200, schema: { example: { deleted: true } } })
  delete(@Param('id') id: string): { deleted: boolean } {
    return this.synonymsService.delete(id);
  }
}
