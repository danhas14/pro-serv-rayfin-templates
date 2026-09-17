import type { AuthUser } from '@/services/IAuthService';
import { getRayfinClient } from '@/services/rayfinClient';
import type { GlossaryCategory as GlossaryCategoryEntity } from '../../rayfin/data/entities/GlossaryCategory';
import type { GlossaryTerm as GlossaryTermEntity } from '../../rayfin/data/entities/GlossaryTerm';
import type {
  AiGlossaryAssist,
  AppRole,
  GlossaryCategory,
  GlossaryFilters,
  GlossaryHomeData,
  GlossarySearchResult,
  GlossaryTerm,
  UpsertCategoryInput,
  UpsertGlossaryTermInput,
} from '@/types/glossary';

function getClient() {
  return getRayfinClient();
}

const EDITOR_EMAILS = new Set(['dev@contoso.com', 'glossary-admin@contoso.com']);
const REQUIRE_EDITOR_ALLOWLIST =
  import.meta.env.VITE_GLOSSARY_REQUIRE_EDITOR_ALLOWLIST === 'true';

const KNOWLEDGE_SYNONYMS: Record<string, string[]> = {
  revenue: ['sales', 'income', 'turnover'],
  customer: ['client', 'account', 'buyer'],
  margin: ['profit margin', 'gross margin'],
  churn: ['attrition', 'customer loss'],
  pipeline: ['funnel', 'opportunity flow'],
  forecast: ['projection', 'outlook'],
  product: ['offering', 'solution'],
};

const SAMPLE_CATEGORIES: Array<{ name: string; description: string }> = [
  { name: 'Finance', description: 'Financial terms used in reporting and planning.' },
  { name: 'Sales', description: 'Pipeline and go-to-market business vocabulary.' },
  { name: 'Data & Analytics', description: 'Data platform and metric definitions.' },
  { name: 'Operations', description: 'Operational and process management language.' },
];

const SAMPLE_TERMS: Array<{
  name: string;
  definition: string;
  synonyms: string[];
  categoryName: string;
  department: string;
  owner: string;
  relatedNames: string[];
}> = [
  {
    name: 'Annual Recurring Revenue (ARR)',
    definition:
      'The normalized yearly value of recurring subscription revenue from active customer contracts.',
    synonyms: ['Recurring Revenue', 'ARR'],
    categoryName: 'Finance',
    department: 'Finance',
    owner: 'Mia Chen',
    relatedNames: ['Monthly Recurring Revenue (MRR)', 'Net Revenue Retention (NRR)'],
  },
  {
    name: 'Monthly Recurring Revenue (MRR)',
    definition:
      'The recurring revenue expected in a single month from subscription agreements, excluding one-time charges.',
    synonyms: ['MRR'],
    categoryName: 'Finance',
    department: 'Finance',
    owner: 'Mia Chen',
    relatedNames: ['Annual Recurring Revenue (ARR)', 'Net Revenue Retention (NRR)'],
  },
  {
    name: 'Net Revenue Retention (NRR)',
    definition:
      'The percentage of recurring revenue retained from existing customers over a period, including expansions and contractions.',
    synonyms: ['NRR', 'Net Dollar Retention'],
    categoryName: 'Finance',
    department: 'Finance',
    owner: 'Mia Chen',
    relatedNames: ['Gross Revenue Retention (GRR)', 'Annual Recurring Revenue (ARR)'],
  },
  {
    name: 'Gross Revenue Retention (GRR)',
    definition:
      'The percentage of recurring revenue retained from existing customers over a period, excluding upsell or expansion revenue.',
    synonyms: ['GRR'],
    categoryName: 'Finance',
    department: 'Finance',
    owner: 'Mia Chen',
    relatedNames: ['Net Revenue Retention (NRR)', 'Churn Rate'],
  },
  {
    name: 'Sales Qualified Lead (SQL)',
    definition:
      'A prospective customer validated by sales criteria and ready for active opportunity management.',
    synonyms: ['SQL', 'Qualified Lead'],
    categoryName: 'Sales',
    department: 'Sales',
    owner: 'Noah Martinez',
    relatedNames: ['Pipeline Coverage', 'Win Rate'],
  },
  {
    name: 'Pipeline Coverage',
    definition:
      'The ratio between the total open opportunity value and the target quota for the same period.',
    synonyms: ['Coverage Ratio', 'Pipeline-to-Quota'],
    categoryName: 'Sales',
    department: 'Sales',
    owner: 'Noah Martinez',
    relatedNames: ['Sales Qualified Lead (SQL)', 'Win Rate', 'Forecast Category'],
  },
  {
    name: 'Win Rate',
    definition:
      'The percentage of opportunities that are successfully closed won out of total opportunities closed.',
    synonyms: ['Close Rate', 'Opportunity Win Rate'],
    categoryName: 'Sales',
    department: 'Sales',
    owner: 'Noah Martinez',
    relatedNames: ['Pipeline Coverage', 'Forecast Category'],
  },
  {
    name: 'Forecast Category',
    definition:
      'A standardized confidence label used by sales teams to classify expected deal outcomes in a forecast period.',
    synonyms: ['Commit Band', 'Forecast Band'],
    categoryName: 'Sales',
    department: 'Sales',
    owner: 'Noah Martinez',
    relatedNames: ['Win Rate', 'Pipeline Coverage'],
  },
  {
    name: 'Golden Dataset',
    definition:
      'A curated and governed dataset designated as the authoritative source for enterprise reporting.',
    synonyms: ['Certified Dataset', 'Trusted Dataset'],
    categoryName: 'Data & Analytics',
    department: 'Data Platform',
    owner: 'Avery Patel',
    relatedNames: ['Data Lineage', 'Business KPI'],
  },
  {
    name: 'Data Lineage',
    definition:
      'The traceable flow of data from origin systems through transformations to published reports and products.',
    synonyms: ['Lineage', 'Data Traceability'],
    categoryName: 'Data & Analytics',
    department: 'Data Platform',
    owner: 'Avery Patel',
    relatedNames: ['Golden Dataset', 'Business KPI'],
  },
  {
    name: 'Business KPI',
    definition:
      'A measurable value tied to strategic outcomes that indicates performance against business goals.',
    synonyms: ['Key Performance Indicator', 'KPI'],
    categoryName: 'Data & Analytics',
    department: 'Business Insights',
    owner: 'Avery Patel',
    relatedNames: ['Golden Dataset', 'Service Level Objective (SLO)'],
  },
  {
    name: 'Service Level Objective (SLO)',
    definition:
      'A target level of service reliability, such as uptime or latency, that teams commit to maintain.',
    synonyms: ['SLO', 'Reliability Target'],
    categoryName: 'Operations',
    department: 'Operations',
    owner: 'Liam Johnson',
    relatedNames: ['Service Level Agreement (SLA)', 'Business KPI'],
  },
  {
    name: 'Service Level Agreement (SLA)',
    definition:
      'A formal commitment defining expected service standards, responsibilities, and remediation for misses.',
    synonyms: ['SLA'],
    categoryName: 'Operations',
    department: 'Operations',
    owner: 'Liam Johnson',
    relatedNames: ['Service Level Objective (SLO)', 'Incident Severity'],
  },
  {
    name: 'Incident Severity',
    definition:
      'A classification that indicates the business impact and urgency of an operational incident.',
    synonyms: ['Severity', 'Incident Priority'],
    categoryName: 'Operations',
    department: 'Operations',
    owner: 'Liam Johnson',
    relatedNames: ['Service Level Agreement (SLA)', 'Mean Time to Resolution (MTTR)'],
  },
  {
    name: 'Mean Time to Resolution (MTTR)',
    definition:
      'The average elapsed time from incident start to full service restoration.',
    synonyms: ['MTTR', 'Average Resolution Time'],
    categoryName: 'Operations',
    department: 'Operations',
    owner: 'Liam Johnson',
    relatedNames: ['Incident Severity', 'Service Level Objective (SLO)'],
  },
  {
    name: 'Churn Rate',
    definition:
      'The percentage of customers or subscriptions that stop renewing during a given period.',
    synonyms: ['Customer Churn', 'Attrition Rate'],
    categoryName: 'Sales',
    department: 'Customer Success',
    owner: 'Noah Martinez',
    relatedNames: ['Net Revenue Retention (NRR)', 'Gross Revenue Retention (GRR)'],
  },
];

let fallbackCategories: GlossaryCategory[] = [];
let fallbackTerms: GlossaryTerm[] = [];

function toIso(value: Date | string | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

function toCsv(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ');
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function mapTerm(raw: GlossaryTermEntity, categories: GlossaryCategory[]): GlossaryTerm {
  const categoryId = raw.category?.id;
  const category = categoryId ? categories.find((item) => item.id === categoryId) : undefined;

  return {
    id: raw.id,
    name: raw.name,
    definition: raw.definition,
    synonyms: parseCsv(raw.synonyms_csv),
    category,
    department: raw.department ?? undefined,
    owner: raw.owner,
    relatedTermIds: parseCsv(raw.related_term_ids_csv),
    createdDate: toIso(raw.created_date),
    modifiedDate: toIso(raw.modified_date),
  };
}

function mapCategory(raw: GlossaryCategoryEntity): GlossaryCategory {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
  };
}

function sortByUpdateDesc(terms: GlossaryTerm[]): GlossaryTerm[] {
  return [...terms].sort((a, b) => +new Date(b.modifiedDate) - +new Date(a.modifiedDate));
}

function getUnique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
}

function buildSearchText(term: GlossaryTerm, relatedNames: string[]): string {
  return [
    term.name,
    term.definition,
    term.synonyms.join(' '),
    term.category?.name ?? '',
    term.owner,
    term.department ?? '',
    relatedNames.join(' '),
  ].join(' ');
}

function scoreSemanticSearch(query: string, term: GlossaryTerm, allTerms: GlossaryTerm[]): GlossarySearchResult {
  const q = normalize(query);
  const queryTokens = tokenize(query);
  const relatedNames = allTerms
    .filter((item) => term.relatedTermIds.includes(item.id))
    .map((item) => item.name);

  let score = 0;
  const reasons: string[] = [];

  const nameValue = normalize(term.name);
  const defValue = normalize(term.definition);
  const synonymValue = normalize(term.synonyms.join(' '));
  const categoryValue = normalize(term.category?.name ?? '');
  const searchText = normalize(buildSearchText(term, relatedNames));

  if (nameValue.includes(q) && q.length > 0) {
    score += 55;
    reasons.push('name match');
  }

  if (synonymValue.includes(q) && q.length > 0) {
    score += 35;
    reasons.push('synonym match');
  }

  if (defValue.includes(q) && q.length > 0) {
    score += 20;
    reasons.push('definition match');
  }

  for (const token of queryTokens) {
    if (nameValue.includes(token)) score += 12;
    if (synonymValue.includes(token)) score += 10;
    if (defValue.includes(token)) score += 6;
    if (categoryValue.includes(token)) score += 6;
    if ((term.department ?? '').toLowerCase().includes(token)) score += 5;
    if (searchText.includes(token)) score += 3;

    const semanticAliases = KNOWLEDGE_SYNONYMS[token] ?? [];
    for (const alias of semanticAliases) {
      if (searchText.includes(normalize(alias))) {
        score += 8;
        reasons.push(`semantic: ${token}`);
        break;
      }
    }
  }

  if (queryTokens.length > 2) {
    const overlap = queryTokens.filter((token) => searchText.includes(token)).length;
    score += overlap * 3;
  }

  if (term.synonyms.some((syn) => queryTokens.includes(normalize(syn)))) {
    score += 16;
  }

  const reason = reasons.length > 0 ? reasons[0] : 'context match';

  return { term, score, reason };
}

async function listCategoriesFromStore(): Promise<GlossaryCategory[]> {
  const categoriesRaw = await getClient().data.GlossaryCategory.first(500).execute();
  return categoriesRaw.map(mapCategory).sort((a, b) => a.name.localeCompare(b.name));
}

async function listTermsFromStore(categories: GlossaryCategory[]): Promise<GlossaryTerm[]> {
  const termsRaw = await getClient().data.GlossaryTerm.first(2000).execute();
  return termsRaw
    .map((item) => mapTerm(item, categories))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function ensureFallbackData(): void {
  if (fallbackCategories.length > 0 && fallbackTerms.length > 0) return;

  fallbackCategories = SAMPLE_CATEGORIES.map((item, index) => ({
    id: `category-${index + 1}`,
    name: item.name,
    description: item.description,
  }));

  fallbackTerms = SAMPLE_TERMS.map((item, index) => {
    const category = fallbackCategories.find((cat) => cat.name === item.categoryName);
    return {
      id: `term-${index + 1}`,
      name: item.name,
      definition: item.definition,
      synonyms: item.synonyms,
      category,
      department: item.department,
      owner: item.owner,
      relatedTermIds: [],
      createdDate: new Date(Date.now() - index * 86400000).toISOString(),
      modifiedDate: new Date(Date.now() - index * 43200000).toISOString(),
    } satisfies GlossaryTerm;
  });

  fallbackTerms = fallbackTerms.map((term) => {
    const seed = SAMPLE_TERMS.find((item) => item.name === term.name);
    const relatedIds =
      seed?.relatedNames
        .map((relatedName) => fallbackTerms.find((item) => item.name === relatedName)?.id)
        .filter(Boolean) ?? [];

    return {
      ...term,
      relatedTermIds: relatedIds as string[],
    };
  });
}

export function resolveUserRole(user: AuthUser | null): AppRole {
  if (!user) return 'viewer';
  if (!REQUIRE_EDITOR_ALLOWLIST) return 'editor';
  return EDITOR_EMAILS.has(user.email.toLowerCase()) ? 'editor' : 'viewer';
}

export async function ensureGlossarySeedData(): Promise<void> {
  ensureFallbackData();

  try {
    const existing = await getClient().data.GlossaryTerm.first(1).execute();
    if (existing.length > 0) return;

    const categoryMap = new Map<string, string>();
    for (const category of SAMPLE_CATEGORIES) {
      const created = await getClient().data.GlossaryCategory.create({
        name: category.name,
        description: category.description,
      });
      categoryMap.set(category.name, created.id);
    }

    const pendingRelated = new Map<string, string[]>();
    const idByName = new Map<string, string>();

    for (const seed of SAMPLE_TERMS) {
      const created = await getClient().data.GlossaryTerm.create({
        name: seed.name,
        definition: seed.definition,
        synonyms_csv: toCsv(seed.synonyms),
        category: categoryMap.get(seed.categoryName)
          ? { id: categoryMap.get(seed.categoryName)! }
          : undefined,
        department: seed.department,
        owner: seed.owner,
        created_date: new Date(),
        modified_date: new Date(),
      });
      idByName.set(seed.name, created.id);
      pendingRelated.set(created.id, seed.relatedNames);
    }

    for (const [termId, relatedNames] of pendingRelated.entries()) {
      const relatedIds = relatedNames.map((name) => idByName.get(name)).filter(Boolean) as string[];
      await getClient().data.GlossaryTerm.update({ id: termId }, { related_term_ids_csv: toCsv(relatedIds) });
    }
  } catch {
    // Local fallback covers environments where glossary entities are not deployed yet.
  }
}

function applyFilters(terms: GlossaryTerm[], filters: GlossaryFilters): GlossaryTerm[] {
  const query = filters.query.trim().toLowerCase();

  return terms.filter((term) => {
    const matchesQuery =
      query.length === 0 ||
      term.name.toLowerCase().includes(query) ||
      term.definition.toLowerCase().includes(query) ||
      term.synonyms.some((synonym) => synonym.toLowerCase().includes(query));

    const matchesCategory = !filters.categoryId || term.category?.id === filters.categoryId;
    const matchesDepartment =
      !filters.department || (term.department ?? '').toLowerCase().includes(filters.department.toLowerCase());
    const matchesOwner = !filters.owner || term.owner.toLowerCase().includes(filters.owner.toLowerCase());

    return matchesQuery && matchesCategory && matchesDepartment && matchesOwner;
  });
}

async function loadHomeDataFromStore(filters: GlossaryFilters): Promise<GlossaryHomeData> {
  const categories = await listCategoriesFromStore();
  const allTerms = await listTermsFromStore(categories);
  const terms = applyFilters(allTerms, filters);

  return {
    terms,
    categories,
    totalTerms: allTerms.length,
    recentUpdates: sortByUpdateDesc(allTerms).slice(0, 5),
    owners: getUnique(allTerms.map((item) => item.owner)),
    departments: getUnique(allTerms.map((item) => item.department)),
  };
}

function loadHomeDataFallback(filters: GlossaryFilters): GlossaryHomeData {
  ensureFallbackData();
  const terms = applyFilters(fallbackTerms, filters);
  return {
    terms,
    categories: fallbackCategories,
    totalTerms: fallbackTerms.length,
    recentUpdates: sortByUpdateDesc(fallbackTerms).slice(0, 5),
    owners: getUnique(fallbackTerms.map((item) => item.owner)),
    departments: getUnique(fallbackTerms.map((item) => item.department)),
  };
}

export async function getGlossaryHomeData(filters: GlossaryFilters): Promise<GlossaryHomeData> {
  ensureFallbackData();
  try {
    return await loadHomeDataFromStore(filters);
  } catch {
    return loadHomeDataFallback(filters);
  }
}

export async function semanticSearchGlossary(query: string): Promise<GlossarySearchResult[]> {
  const home = await getGlossaryHomeData({ query: '', categoryId: undefined, department: undefined, owner: undefined });

  if (query.trim().length === 0) {
    return home.terms.slice(0, 10).map((term) => ({ term, score: 0, reason: 'latest terms' }));
  }

  return home.terms
    .map((term) => scoreSemanticSearch(query, term, home.terms))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

export async function getGlossaryTermById(termId: string): Promise<GlossaryTerm | null> {
  const home = await getGlossaryHomeData({ query: '', categoryId: undefined, department: undefined, owner: undefined });
  return home.terms.find((item) => item.id === termId) ?? null;
}

export async function listRelatedTerms(termId: string): Promise<GlossaryTerm[]> {
  const term = await getGlossaryTermById(termId);
  if (!term) return [];

  const home = await getGlossaryHomeData({ query: '', categoryId: undefined, department: undefined, owner: undefined });

  const directlyLinked = home.terms.filter((item) => term.relatedTermIds.includes(item.id));
  if (directlyLinked.length >= 4) return directlyLinked.slice(0, 6);

  const fallbackRelated = home.terms
    .filter((item) => item.id !== term.id)
    .map((item) => {
      let score = 0;
      if (item.category?.id && item.category.id === term.category?.id) score += 3;
      if ((item.department ?? '') === (term.department ?? '')) score += 2;
      if (item.owner === term.owner) score += 1;

      const tokenOverlap = tokenize(item.definition)
        .filter((token) => tokenize(term.definition).includes(token)).length;
      score += Math.min(tokenOverlap, 6);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6 - directlyLinked.length)
    .map((entry) => entry.item);

  return [...directlyLinked, ...fallbackRelated];
}

function assertEditor(user: AuthUser | null): void {
  if (resolveUserRole(user) !== 'editor') {
    throw new Error('You do not have permission to perform this action.');
  }
}

export async function upsertGlossaryTerm(input: UpsertGlossaryTermInput, user: AuthUser | null): Promise<string> {
  assertEditor(user);

  const payload = {
    name: input.name,
    definition: input.definition,
    synonyms_csv: toCsv(input.synonyms),
    category: input.categoryId ? { id: input.categoryId } : undefined,
    department: input.department,
    owner: input.owner,
    related_term_ids_csv: toCsv(input.relatedTermIds),
    modified_date: new Date(),
  };

  try {
    if (!input.id) {
      const created = await getClient().data.GlossaryTerm.create({ ...payload, created_date: new Date() });
      return created.id;
    }

    const updated = await getClient().data.GlossaryTerm.update({ id: input.id }, payload);
    return updated.id;
  } catch {
    ensureFallbackData();
    if (!input.id) {
      const id = `term-${Date.now()}`;
      fallbackTerms.unshift({
        id,
        name: input.name,
        definition: input.definition,
        synonyms: input.synonyms,
        category: fallbackCategories.find((item) => item.id === input.categoryId),
        department: input.department,
        owner: input.owner,
        relatedTermIds: input.relatedTermIds,
        createdDate: new Date().toISOString(),
        modifiedDate: new Date().toISOString(),
      });
      return id;
    }

    fallbackTerms = fallbackTerms.map((term) =>
      term.id === input.id
        ? {
            ...term,
            name: input.name,
            definition: input.definition,
            synonyms: input.synonyms,
            category: fallbackCategories.find((item) => item.id === input.categoryId),
            department: input.department,
            owner: input.owner,
            relatedTermIds: input.relatedTermIds,
            modifiedDate: new Date().toISOString(),
          }
        : term
    );
    return input.id;
  }
}

export async function deleteGlossaryTerm(termId: string, user: AuthUser | null): Promise<void> {
  assertEditor(user);
  try {
    await getClient().data.GlossaryTerm.delete({ id: termId });
  } catch {
    fallbackTerms = fallbackTerms.filter((item) => item.id !== termId);
    fallbackTerms = fallbackTerms.map((item) => ({
      ...item,
      relatedTermIds: item.relatedTermIds.filter((id) => id !== termId),
    }));
  }
}

export async function listGlossaryCategories(): Promise<GlossaryCategory[]> {
  ensureFallbackData();
  try {
    return await listCategoriesFromStore();
  } catch {
    return [...fallbackCategories];
  }
}

export async function upsertGlossaryCategory(input: UpsertCategoryInput, user: AuthUser | null): Promise<string> {
  assertEditor(user);

  try {
    if (!input.id) {
      const created = await getClient().data.GlossaryCategory.create({
        name: input.name,
        description: input.description,
      });
      return created.id;
    }

    const updated = await getClient().data.GlossaryCategory.update(
      { id: input.id },
      {
        name: input.name,
        description: input.description,
      }
    );
    return updated.id;
  } catch {
    ensureFallbackData();
    if (!input.id) {
      const id = `category-${Date.now()}`;
      fallbackCategories.unshift({
        id,
        name: input.name,
        description: input.description,
      });
      return id;
    }

    fallbackCategories = fallbackCategories.map((category) =>
      category.id === input.id
        ? { ...category, name: input.name, description: input.description }
        : category
    );
    return input.id;
  }
}

export async function deleteGlossaryCategory(categoryId: string, user: AuthUser | null): Promise<void> {
  assertEditor(user);

  try {
    await getClient().data.GlossaryCategory.delete({ id: categoryId });
  } catch {
    fallbackCategories = fallbackCategories.filter((item) => item.id !== categoryId);
    fallbackTerms = fallbackTerms.map((term) =>
      term.category?.id === categoryId ? { ...term, category: undefined } : term
    );
  }
}

export async function buildAiAssist(termId: string): Promise<AiGlossaryAssist | null> {
  const term = await getGlossaryTermById(termId);
  if (!term) return null;

  const suggestedRelatedTerms = await listRelatedTerms(term.id);
  const suggestedSynonyms = suggestSynonyms(term.name, term.definition, term.synonyms);
  const draftDefinition = generateDraftDefinition(term.name, term.category?.name, suggestedSynonyms);
  const plainLanguageExplanation = explainInPlainLanguage(term.name, term.definition);

  return {
    suggestedRelatedTerms,
    suggestedSynonyms,
    draftDefinition,
    plainLanguageExplanation,
  };
}

export function suggestSynonyms(name: string, definition: string, existing: string[] = []): string[] {
  const tokens = [...tokenize(name), ...tokenize(definition)];
  const discovered = new Set<string>(existing.map((item) => item.trim()).filter(Boolean));

  for (const token of tokens) {
    (KNOWLEDGE_SYNONYMS[token] ?? []).forEach((alias) => discovered.add(alias));
  }

  if (name.includes('Rate')) {
    discovered.add('Percentage Metric');
  }
  if (name.includes('Revenue')) {
    discovered.add('Revenue Metric');
  }

  return [...discovered].slice(0, 10);
}

export function generateDraftDefinition(name: string, category?: string, synonyms: string[] = []): string {
  const synonymPhrase = synonyms.length > 0 ? ` It is also known as ${synonyms.slice(0, 3).join(', ')}.` : '';
  const categoryPhrase = category ? ` within the ${category} domain` : '';
  return `${name} is a business term${categoryPhrase} used by Contoso teams to standardize decision-making and reporting.${synonymPhrase}`;
}

export function explainInPlainLanguage(name: string, definition: string): string {
  const plain = definition
    .replace(/normalized|standardized|authoritative|curated/gi, 'consistent')
    .replace(/percentage/gi, 'share')
    .replace(/recurring/gi, 'repeat');

  return `${name} means: ${plain}`;
}
