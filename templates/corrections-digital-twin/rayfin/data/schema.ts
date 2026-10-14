/**
 * The digital twin renders a curated, in-bundle operational dataset, so no
 * Rayfin data entities are defined and the `data` service is disabled in
 * `rayfin.yml`. The empty schema keeps `RayfinClient` typed for auth-only use.
 */
export type FacilitySchema = Record<string, never>;

export const schema = [];
