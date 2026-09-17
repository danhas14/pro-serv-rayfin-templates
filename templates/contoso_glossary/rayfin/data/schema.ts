import { GlossaryCategory } from './entities/GlossaryCategory.js';
import { GlossaryTerm } from './entities/GlossaryTerm.js';

export type AppSchema = {
	GlossaryCategory: GlossaryCategory;
	GlossaryTerm: GlossaryTerm;
};

export const schema = [
	GlossaryCategory,
	GlossaryTerm,
];
