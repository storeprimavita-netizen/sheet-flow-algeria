import { ButtonLink } from "@/components/button-link";

/** Banner over /app/orders/all in statistics drill mode: the metric, then wilaya / delivery type / commune
 * (empty parts are skipped), and the way back to every order (which also drops the drill params). */
export function DrillBanner({ metric, parts, clearLabel }: { metric: string; parts: string[]; clearLabel: string }) {
  return (
    <div className="card-surface flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm" role="status">
      <p>
        <span className="font-medium text-foreground">{metric}</span>
        <span className="text-muted-foreground">
          {parts.filter(Boolean).map((p) => ` · ${p}`).join("")}
        </span>
      </p>
      <ButtonLink href="/app/orders/all" size="sm" variant="outline">{clearLabel}</ButtonLink>
    </div>
  );
}
