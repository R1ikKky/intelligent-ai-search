import type { Client } from '@elastic/elasticsearch';
import type { Ste } from '../../domain/entities/ste.entity';
import { steToDoc } from './indexing.ops';

export async function bulkIndexSte(es: Client, index: string, stes: Ste[]): Promise<void> {
  if (!stes.length) return;
  const operations = stes.flatMap((s) => [
    { index: { _index: index, _id: s.id } },
    steToDoc(s),
  ]);
  await es.bulk({ operations, refresh: true });
}
