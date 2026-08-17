import { z } from "zod";

export const memberCreateSchema = z.object({
  firstName: z.string().min(1, "Vorname erforderlich"),
  lastName: z.string().min(1, "Nachname erforderlich"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  instrument: z.string().min(1, "Instrument erforderlich"),
  active: z.boolean().default(true),
  joinedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const memberUpdateSchema = memberCreateSchema.partial();

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
