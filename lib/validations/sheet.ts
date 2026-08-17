import { z } from "zod";
import { sheetDifficulty } from "@/lib/validations/enums";

export const sheetCreateSchema = z.object({
  title: z.string().min(1, "Titel erforderlich"),
  composer: z.string().optional(),
  genre: z.string().optional(),
  difficulty: sheetDifficulty.optional(),
  storage: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type SheetCreateInput = z.infer<typeof sheetCreateSchema>;
