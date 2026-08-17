import { z } from "zod";

export const rehearsalCreateSchema = z.object({
  title: z.string().min(1, "Titel erforderlich"),
  startsAt: z.coerce.date(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export type RehearsalCreateInput = z.infer<typeof rehearsalCreateSchema>;
