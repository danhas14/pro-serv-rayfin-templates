import { authenticated, date, entity, one, text, uuid } from '@microsoft/rayfin-core';

import { GlossaryCategory } from './GlossaryCategory.js';

@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'])
export class GlossaryTerm {
  @uuid()
  id!: string;

  @text({ max: 200 })
  name!: string;

  @text()
  definition!: string;

  @text({ optional: true, max: 2000 })
  synonyms_csv?: string;

  @one(() => GlossaryCategory, { optional: true })
  category?: GlossaryCategory;

  @text({ optional: true, max: 120 })
  department?: string;

  @text({ max: 200 })
  owner!: string;

  @text({ optional: true, max: 2000 })
  related_term_ids_csv?: string;

  @date()
  created_date!: Date;

  @date()
  modified_date!: Date;
}
