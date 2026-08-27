import { z } from "zod";

export const attendanceStatus = z.enum(["PRESENT", "EXCUSED", "ABSENT"]);
export type AttendanceStatus = z.infer<typeof attendanceStatus>;

export const sheetDifficulty = z.enum(["LEICHT", "MITTEL", "SCHWER"]);
export type SheetDifficulty = z.infer<typeof sheetDifficulty>;

// Instrumentenverwaltung (LUH-216) – Register/Typ und Zustand.
// Werte sind bewusst die deutschen Display-Strings (im UI 1:1 angezeigt).
export const instrumentRegister = z.enum([
  "Klarinette",
  "Flöte",
  "Trompete",
  "Posaune",
  "Horn",
  "Tenorhorn/Bariton",
  "Tuba",
  "Schlagwerk",
]);
export type InstrumentRegister = z.infer<typeof instrumentRegister>;

export const instrumentCondition = z.enum([
  "Neuwertig",
  "Gut",
  "Bedingt",
  "Reparaturbedürftig",
  "Ausgesondert",
]);
export type InstrumentCondition = z.infer<typeof instrumentCondition>;
