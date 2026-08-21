import { z } from "zod";

// Cast entry (Besetzung): a member plus an optional role, e.g. "Solist".
export const eventMemberInputSchema = z.object({
  memberId: z.string().min(1, "Mitglied erforderlich"),
  role: z.string().optional(),
});

export type EventMemberInput = z.infer<typeof eventMemberInputSchema>;

export const eventCreateSchema = z.object({
  title: z.string().min(1, "Titel erforderlich"),
  startsAt: z.coerce.date(),
  location: z.string().min(1, "Ort erforderlich"),
  notes: z.string().optional(),
  members: z.array(eventMemberInputSchema).optional(),
});

export type EventCreateInput = z.infer<typeof eventCreateSchema>;

// Update is partial; `members`, if present, fully replaces the cast.
export const eventUpdateSchema = eventCreateSchema.partial().extend({
  members: z.array(eventMemberInputSchema).optional(),
});

export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
