import { Contract } from './Contract.js';

/**
 * Schema type map for the Contract Analyzer App v2.
 *
 * Maps entity names to their model types so `RayfinClient<AppSchema>` gives
 * `client.data.Contract` full type safety end to end.
 */
export type AppSchema = {
  Contract: Contract;
};

export const schema = [Contract];
