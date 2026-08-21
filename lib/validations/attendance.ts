import { z } from "zod";

import { attendanceStatus } from "./enums";

export const attendanceSchema = z.object({
  memberId: z.string().min(1, "Mitglied erforderlich"),
  status: attendanceStatus,
  note: z.string().optional(),
});

export const attendanceBulkSchema = z.object({
  items: z
    .array(attendanceSchema)
    .min(1, "Mindestens ein Anwesenheitseintrag erforderlich"),
});

export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type AttendanceBulkInput = z.infer<typeof attendanceBulkSchema>;
