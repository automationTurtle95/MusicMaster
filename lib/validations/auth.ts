import { z } from "zod";

export const Role = z.enum(["ADMIN", "BOARD", "MEMBER"]);
export type Role = z.infer<typeof Role>;

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SignInInput = z.infer<typeof signInSchema>;
