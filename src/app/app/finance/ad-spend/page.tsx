import { redirect } from "next/navigation";

// ponytail: the ad-spend entry widget lives on the dashboard until phase 12.
export default function FinanceAdSpendPage() {
  redirect("/app/dashboard");
}
