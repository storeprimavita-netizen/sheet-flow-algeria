import type { Role } from "@/lib/roles";

/** Where a role lands: agents on "My day", admins on the dashboard, no profile on /no-access. */
export function roleHome(role: Role | null): string {
  if (role === "admin") return "/app/dashboard";
  if (role === "confirmation_agent" || role === "delivery_agent") return "/app/my-day";
  return "/no-access";
}
