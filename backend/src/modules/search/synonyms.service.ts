import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateSynonymDto, SynonymGroupDto } from './dto/synonym.dto';

// In-memory store for hackathon; replace with DB persistence for production
@Injectable()
export class SynonymsService {
  private readonly groups: Map<string, string[]> = new Map();

  create(dto: CreateSynonymDto): SynonymGroupDto {
    const id = randomUUID();
    this.groups.set(id, dto.terms);
    return { id, terms: dto.terms };
  }

  findAll(): SynonymGroupDto[] {
    return Array.from(this.groups.entries()).map(([id, terms]) => ({ id, terms }));
  }

  delete(id: string): { deleted: boolean } {
    return { deleted: this.groups.delete(id) };
  }

  getSynonymLines(): string[] {
    return Array.from(this.groups.values()).map((terms) => terms.join(', '));
  }
}
