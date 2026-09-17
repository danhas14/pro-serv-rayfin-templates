import { authenticated, entity, many, text, uuid } from '@microsoft/rayfin-core';

import { GlossaryTerm } from './GlossaryTerm.js';

@entity()
@authenticated('read')
@authenticated(['create', 'update', 'delete'])
export class GlossaryCategory {
  @uuid()
  id!: string;

  @text({ max: 120 })
  name!: string;

  @text({ optional: true, max: 512 })
  description?: string;

  @many(() => GlossaryTerm)
  terms?: GlossaryTerm[];
}
