import { z } from "zod";

export const eventCreateSchema = z.object({
  title: z.string().min(1, "Titel erforderlich"),
  startsAt: z.coerce.date(),
  location: z.string().min(1, "Ort erforderlich"),
  notes: z.string().optional(),
});

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
