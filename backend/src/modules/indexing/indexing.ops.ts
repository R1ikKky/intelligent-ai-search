import type { Ste } from '../../domain/entities/ste.entity';
import type { SearchableProductDoc } from './indexing.types';

export function steToDoc(ste: Ste): SearchableProductDoc {
  return {
    id: ste.id,
    externalId: ste.id,
    name: ste.name,
    description: ste.searchText || ste.name,
    category: ste.category,
    unit: 'шт',
    price: null,
    synonyms: [],
    embedding: ste.embedding?.length ? ste.embedding : null,
  };
}
