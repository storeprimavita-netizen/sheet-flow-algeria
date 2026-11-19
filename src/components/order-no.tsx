import { formatOrderNo } from "@/lib/format";

/** Running order number (D57), `#0001`; `<bdi dir="ltr">` keeps it intact inside Arabic text. */
export function OrderNo({ seq, className }: { seq: number | null | undefined; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {formatOrderNo(seq)}
    </bdi>
  );
}
