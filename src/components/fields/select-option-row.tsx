import { ColorDot } from "@/components/ui/chip";
import type { StatusToken } from "@/lib/statuses";

/** SelectItem content: label, plus a color dot when the option carries one. */
export function SelectOptionRow({ label, token }: { label: string; token?: StatusToken }) {
  if (!token) return <>{label}</>;
  return (
    <span className="flex items-center gap-2">
      <ColorDot token={token} />
      {label}
    </span>
  );
}
