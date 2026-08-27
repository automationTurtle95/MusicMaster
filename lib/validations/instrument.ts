import { z } from "zod";

import {
  instrumentCondition,
  instrumentRegister,
} from "@/lib/validations/enums";

// Inventarnummer eindeutig (per Unique-Constraint in der DB geprüft).
export const instrumentCreateSchema = z.object({
  type: instrumentRegister,
  inventoryNumber: z.string().min(1, "Inventarnummer erforderlich"),
  condition: instrumentCondition,
  memberId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
});

export const instrumentUpdateSchema = instrumentCreateSchema.partial();

export type InstrumentCreateInput = z.infer<typeof instrumentCreateSchema>;
export type InstrumentUpdateInput = z.infer<typeof instrumentUpdateSchema>;
