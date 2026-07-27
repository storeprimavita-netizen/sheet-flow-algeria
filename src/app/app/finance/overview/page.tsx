import { redirect } from "next/navigation";

// ponytail: Finance Overview lives on the dashboard until phase 12 builds it out.
export default function FinanceOverviewPage() {
  redirect("/app/dashboard");
}
