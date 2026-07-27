import { redirect } from "next/navigation";

// ponytail: income = collected cash; lives at orders/cash until phase 12 builds Finance.
export default function FinanceIncomePage() {
  redirect("/app/orders/cash");
}
