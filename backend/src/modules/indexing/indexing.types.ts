export interface SearchableProductDoc {
  id: string;
  externalId: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  price: number | null;
  synonyms: string[];
  embedding?: number[] | null;
}
