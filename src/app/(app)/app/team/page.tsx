import { redirect } from "next/navigation";

/** Team section landing — users/audit moved to settings; redirect to rules. */
export default function TeamPage() {
  redirect("/app/team/rules");
}
