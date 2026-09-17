export type AppRole = 'viewer' | 'editor';

export interface GlossaryCategory {
  id: string;
  name: string;
  description?: string;
}

export interface GlossaryTerm {
  id: string;
  name: string;
  definition: string;
  synonyms: string[];
  category?: GlossaryCategory;
  department?: string;
  owner: string;
  relatedTermIds: string[];
  createdDate: string;
  modifiedDate: string;
}

export interface GlossaryFilters {
  query: string;
  categoryId?: string;
  department?: string;
  owner?: string;
}

export interface GlossarySearchResult {
  term: GlossaryTerm;
  score: number;
  reason: string;
}

export interface GlossaryHomeData {
  terms: GlossaryTerm[];
  categories: GlossaryCategory[];
  totalTerms: number;
  recentUpdates: GlossaryTerm[];
  owners: string[];
  departments: string[];
}

export interface UpsertGlossaryTermInput {
  id?: string;
  name: string;
  definition: string;
  synonyms: string[];
  categoryId?: string;
  department?: string;
  owner: string;
  relatedTermIds: string[];
}

export interface UpsertCategoryInput {
  id?: string;
  name: string;
  description?: string;
}

export interface AiGlossaryAssist {
  suggestedSynonyms: string[];
  suggestedRelatedTerms: GlossaryTerm[];
  draftDefinition: string;
  plainLanguageExplanation: string;
}
