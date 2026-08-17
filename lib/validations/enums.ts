import { z } from "zod";

export const attendanceStatus = z.enum(["PRESENT", "EXCUSED", "ABSENT"]);
export type AttendanceStatus = z.infer<typeof attendanceStatus>;

export const sheetDifficulty = z.enum(["LEICHT", "MITTEL", "SCHWER"]);
export type SheetDifficulty = z.infer<typeof sheetDifficulty>;
