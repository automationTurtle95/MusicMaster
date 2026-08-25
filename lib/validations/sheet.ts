import { z } from "zod";
import { sheetDifficulty } from "@/lib/validations/enums";

export const sheetCreateSchema = z.object({
  title: z.string().min(1, "Titel erforderlich"),
  composer: z.string().optional(),
  genre: z.string().optional(),
  difficulty: sheetDifficulty.optional(),
  storage: z.string().optional(),
  // Erlaubt: leer, externe http(s)-URL (manuell gepflegt) ODER interne
  // Serve-Route aus dem Upload (z. B. "/api/sheets/file/<uuid>.pdf"). Letztere
  // wird serverseitig aus dem persistenten Speicher ausgeliefert.
  fileUrl: z
    .union([
      z.literal(""),
      z.string().url("Gültige URL erforderlich"),
      z
        .string()
        .regex(
          /^\/api\/sheets\/file\/[A-Za-z0-9_-]+\.pdf$/i,
          "Ungültige interne Datei-Route"
        ),
    ])
    .optional(),
  notes: z.string().optional(),
});

export const sheetUpdateSchema = sheetCreateSchema.partial();

export type SheetCreateInput = z.infer<typeof sheetCreateSchema>;
export type SheetUpdateInput = z.infer<typeof sheetUpdateSchema>;
