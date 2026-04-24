import { z } from 'zod';
import { LAND_USE_ZONES } from '../../features/scoping/zone';

export const landUseZoneEnum = z.enum(
  LAND_USE_ZONES as unknown as [string, ...string[]],
);

export const areaUnitEnum = z.enum(['sqm', 'ha']);

export const scopingInputSchema = z.object({
  site_area_m2: z.number().min(0).max(10_000_000),
  site_area_input_unit: areaUnitEnum,
  land_use_zone: landUseZoneEnum,
  forest_conversion_m2: z.number().min(0).max(10_000_000).optional(),
  forest_conversion_input_unit: areaUnitEnum.optional(),
  capacity_mw_override: z.number().min(0).max(10_000).optional(),
  notes: z.string().max(1000).optional(),
});

export type ScopingInput = z.infer<typeof scopingInputSchema>;
