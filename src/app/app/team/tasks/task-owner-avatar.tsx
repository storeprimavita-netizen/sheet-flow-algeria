function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Small initials circle — the "owner avatar" the checklist asks for (no
 * profile-photo storage in this app, per docs/PROGRESS.md's product-images
 * backlog note — initials are the lightest thing that reads as an avatar). */
export function TaskOwnerAvatar({ name }: { name: string | null }) {
  return (
    <span
      title={name ?? undefined}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold text-muted-foreground"
    >
      {initials(name)}
    </span>
  );
}
