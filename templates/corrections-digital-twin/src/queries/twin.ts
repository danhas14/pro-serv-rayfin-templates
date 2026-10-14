/**
 * DAX queries issued against the North Valley Corrections Twin semantic model.
 *
 * Each query is paired with the column order the loader expects, so a change to
 * the projection is caught in one place rather than through silently shifted
 * row indexes.
 */

/** Building dimension joined to its current-period readings. */
export const BUILDING_INVENTORY_QUERY = `
EVALUATE
SUMMARIZECOLUMNS (
    'Building'[Building ID],
    'Building'[Building],
    'Building'[Short Name],
    'Building'[Building Type],
    'Building'[Operational Status],
    'Building'[Is Residential],
    'Building'[Operational Note],
    "Capacity", [Rated Capacity],
    "Inmates", [Inmates],
    "Officers", [Officers],
    "Incidents", [Monthly Incidents]
)
ORDER BY 'Building'[Building ID]
`.trim();

export const BUILDING_INVENTORY_COLUMNS = [
  'Building[Building ID]',
  'Building[Building]',
  'Building[Short Name]',
  'Building[Building Type]',
  'Building[Operational Status]',
  'Building[Is Residential]',
  'Building[Operational Note]',
  '[Capacity]',
  '[Inmates]',
  '[Officers]',
  '[Incidents]',
] as const;

/** Monthly readings for every building. */
export const BUILDING_HISTORY_QUERY = `
EVALUATE
SUMMARIZECOLUMNS (
    'Building'[Building ID],
    'Month'[Month Key],
    "Inmates", [Inmates],
    "Officers", [Officers],
    "Incidents", [Incidents]
)
ORDER BY 'Building'[Building ID], 'Month'[Month Key]
`.trim();

export const BUILDING_HISTORY_COLUMNS = [
  'Building[Building ID]',
  'Month[Month Key]',
  '[Inmates]',
  '[Officers]',
  '[Incidents]',
] as const;

/** Facility-wide roll-up per month, plus the month dimension itself. */
export const FACILITY_HISTORY_QUERY = `
EVALUATE
SUMMARIZECOLUMNS (
    'Month'[Month Key],
    'Month'[Month],
    'Month'[Month Abbreviation],
    "Population", [Facility Population],
    "Officers", [Facility Officers],
    "Incidents", [Facility Incidents],
    "DesignCapacity", [Facility Design Capacity]
)
ORDER BY 'Month'[Month Key]
`.trim();

export const FACILITY_HISTORY_COLUMNS = [
  'Month[Month Key]',
  'Month[Month]',
  'Month[Month Abbreviation]',
  '[Population]',
  '[Officers]',
  '[Incidents]',
  '[DesignCapacity]',
] as const;
