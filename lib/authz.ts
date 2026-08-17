import type { Role } from "@/lib/validations/auth";

export const MANAGER_ROLES: Role[] = ["ADMIN", "BOARD"];

export function isManager(role: Role | undefined): boolean {
  return role ? MANAGER_ROLES.includes(role) : false;
}
