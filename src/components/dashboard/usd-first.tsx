import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatUsd } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * USD-first figure (D45: ad spend and cost per delivered are paid in USD):
 * USD big, DZD small and grey under it, tooltip with the rate and its date.
 * No rate -> DZD only plus a hint to set one. Never converts: both amounts
 * come from SQL (`kpi.*_usd` / `kpi.*_dzd`).
 */
export function UsdFirst({
  usd,
  dzd,
  rate,
  date,
  rateLabel,
  noRateHint,
  className,
}: {
  usd: number | null | undefined;
  dzd: number | null | undefined;
  rate: number | null | undefined;
  date?: string | null;
  /** "Rate {rate} DA per $ ({date})" — already translated */
  rateLabel: (rate: string, date: string) => string;
  /** "Set a USD rate" */
  noRateHint: string;
  className?: string;
}) {
  if (rate == null || usd == null) {
    return (
      <span className={cn("flex flex-col", className)}>
        <span className="num whitespace-nowrap">{formatCurrency(dzd)}</span>
        <span className="block text-xs font-normal text-muted-foreground">{noRateHint}</span>
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("flex flex-col cursor-help", className)}>
          <span className="num whitespace-nowrap">{formatUsd(usd)}</span>
          <span className="num block whitespace-nowrap text-sm font-normal text-muted-foreground">{formatCurrency(dzd)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{rateLabel(String(rate), date ? formatDate(date) : "—")}</TooltipContent>
    </Tooltip>
  );
}
