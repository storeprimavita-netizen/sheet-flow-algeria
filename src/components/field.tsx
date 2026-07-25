import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Form field wrapper: label + control, consistent spacing. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
        {hint ? <span className="ms-1 opacity-60">· {hint}</span> : null}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const fieldInputClass = inputCls;

/** Style string applied to a table to skin every cell at once. */
export const tableClass = cn(
  "w-full text-sm",
  "[&_th]:text-start [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:px-3 [&_th]:py-2",
  "[&_td]:px-3 [&_td]:py-2",
  "[&_tbody_tr]:border-b [&_tbody_tr]:border-border",
);
