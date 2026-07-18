import { z } from "zod";

export const createGameBannerSchema = z.object({
  name: z.string().nullable().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  freePulls: z.number().int().min(0).default(0),
  isSelectablePickup: z.boolean().default(false),
  pickupStudentIds: z.array(z.string()).min(1),
});

export const updateGameBannerSchema = z.object({
  name: z.string().nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  freePulls: z.number().int().min(0).optional(),
  isSelectablePickup: z.boolean().optional(),
  pickupStudentIds: z.array(z.string()).min(1).optional(),
});

export const updateGameBannerGroupSchema = z.object({
  oldStartDate: z.string().datetime(),
  oldEndDate: z.string().datetime(),
  newStartDate: z.string().datetime(),
  newEndDate: z.string().datetime(),
});

export const offsetGameBannersSchema = z.object({
  currentStartDate: z.string().datetime(),
  offsetDays: z.number().int(),
});

export type CreateGameBannerInput = z.infer<typeof createGameBannerSchema>;
export type UpdateGameBannerInput = z.infer<typeof updateGameBannerSchema>;
export type UpdateGameBannerGroupInput = z.infer<
  typeof updateGameBannerGroupSchema
>;
export type OffsetGameBannersInput = z.infer<typeof offsetGameBannersSchema>;
