export function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Meta size cell shows unless the admin size card already shows the size (or there is no size). */
export function showsSizeCell(isAdmin: boolean, sizesCount: number, variant: string | null | undefined): boolean {
  return !!variant && !(isAdmin && sizesCount > 0);
}

/** Size label cell; the page hides it when the admin size card shows the size. */
export function SizeMeta({ label, size }: { label: string; size: string }) {
  return (
    <Meta label={label}>
      <bdi>{size}</bdi>
    </Meta>
  );
}

/** "16-Algiers": code and name in explicit order so RTL cannot flip them. */
export function WilayaValue({ code, name }: { code: number | string | null; name: string }) {
  return (
    <>
      {code != null && code !== "" && (
        <>
          <span className="num">{code}</span>-
        </>
      )}
      <bdi>{name}</bdi>
    </>
  );
}
