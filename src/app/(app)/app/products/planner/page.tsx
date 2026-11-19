import { redirect } from "next/navigation";

/** Old bookmark: the BENZ planner is retired, Pricing now lives at /app/pricing. */
export default function PricingPlannerRedirect(): never {
  redirect("/app/pricing");
}
