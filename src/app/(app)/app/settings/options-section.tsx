"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Check,
  X,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Trash2,
  GitMerge,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { OptionSetKey, OptionRow } from "@/lib/option-sets";
import { CHIP_TOKENS, type StatusToken } from "@/lib/statuses";
import { ColorDot } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createOption,
  renameOption,
  recolorOption,
  moveOption,
  setOptionArchived,
  mergeOption,
  deleteOption,
  type ActionResult,
} from "@/lib/option-sets-actions";

type SetData = { id: string; key: OptionSetKey; label: string; allowsMulti: boolean; options: OptionRow[] };

/** Settings → Options: every option set, reorderable/recolorable/renamable/archivable/mergeable, with usage counts. */
export function OptionsSection({
  sets,
  usage,
}: {
  sets: SetData[];
  usage: Record<OptionSetKey, Record<string, number>>;
}) {
  const t = useTranslations();
  return (
    <section id="options" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <div>
        <h2 className="text-sm font-semibold">{t("settings.options.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.options.subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sets.map((s) => (
          <OptionSetCard key={s.id} set={s} usage={usage[s.key] ?? {}} />
        ))}
      </div>
    </section>
  );
}

function OptionSetCard({ set, usage }: { set: SetData; usage: Record<string, number> }) {
  const t = useTranslations();
  const router = useRouter();
  const [newLabel, setNewLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    const res = await createOption(set.key, label);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNewLabel("");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{t(`settings.options.sets.${set.key}`)}</h3>
        {set.allowsMulti ? (
          <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted-foreground">
            {t("settings.options.multi")}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5">
        {set.options.map((o, i) => (
          <OptionRowItem
            key={o.id}
            setKey={set.key}
            option={o}
            siblings={set.options.filter((x) => x.id !== o.id && !x.archived_at)}
            usage={usage[o.id] ?? 0}
            isFirst={i === 0}
            isLast={i === set.options.length - 1}
          />
        ))}
        {set.options.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("settings.options.empty")}</p>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={t("settings.options.addPlaceholder")}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={busy || !newLabel.trim()}>
          {t("actions.add")}
        </Button>
      </div>
    </div>
  );
}

function OptionRowItem({
  setKey,
  option,
  siblings,
  usage,
  isFirst,
  isLast,
}: {
  setKey: OptionSetKey;
  option: OptionRow;
  siblings: OptionRow[];
  usage: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = React.useState<null | "rename" | "merge">(null);
  const [label, setLabel] = React.useState(option.label);
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => Promise<ActionResult>) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  if (mode === "rename") {
    return (
      <div className="flex items-center gap-1 py-1">
        <Input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run(() => renameOption(option.id, label));
              setMode(null);
            }
            if (e.key === "Escape") {
              setLabel(option.label);
              setMode(null);
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled={busy}
          aria-label={t("actions.confirm")}
          onClick={() => {
            run(() => renameOption(option.id, label));
            setMode(null);
          }}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          aria-label={t("actions.cancel")}
          onClick={() => {
            setLabel(option.label);
            setMode(null);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (mode === "merge") {
    return (
      <div className="flex items-center gap-1 py-1">
        <span className="shrink-0 text-xs text-muted-foreground">{t("settings.options.mergeInto")}</span>
        <Combobox
          options={siblings.map((s) => ({ value: s.id, label: s.label }))}
          placeholder={t("actions.select")}
          onChange={(v) => {
            const target = siblings.find((s) => s.id === v);
            if (!target) return;
            if (!window.confirm(t("settings.options.mergeConfirm", { from: option.label, to: target.label }))) return;
            run(() => mergeOption(option.id, v));
            setMode(null);
          }}
        />
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={t("actions.cancel")} onClick={() => setMode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-raised">
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          disabled={isFirst || busy}
          onClick={() => run(() => moveOption(option.id, "up"))}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label={t("settings.options.moveUp")}
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          disabled={isLast || busy}
          onClick={() => run(() => moveOption(option.id, "down"))}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label={t("settings.options.moveDown")}
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
      <ColorPicker token={option.color_token} onPick={(tok) => run(() => recolorOption(option.id, tok))} />
      <span
        title={option.archived_at ? t("settings.options.archivedHint") : undefined}
        className={cn("flex-1 truncate text-sm", option.archived_at && "text-muted-foreground line-through")}
      >
        {option.label}
      </span>
      <span className="num shrink-0 text-xs text-muted-foreground">
        {t("settings.options.usageCount", { count: usage })}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={t("actions.moreOptions")}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setMode("rename")}>
            <Pencil className="h-4 w-4" /> {t("actions.rename")}
          </DropdownMenuItem>
          {siblings.length > 0 ? (
            <DropdownMenuItem onSelect={() => setMode("merge")}>
              <GitMerge className="h-4 w-4" /> {t("settings.options.mergeInto")}
            </DropdownMenuItem>
          ) : null}
          {option.archived_at ? (
            <DropdownMenuItem onSelect={() => run(() => setOptionArchived(option.id, false))}>
              <ArchiveRestore className="h-4 w-4" /> {t("settings.options.unarchive")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(() => setOptionArchived(option.id, true))}>
              <Archive className="h-4 w-4" /> {t("settings.options.archive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            disabled={usage > 0}
            onSelect={() => {
              if (!window.confirm(t("common.deleteConfirm"))) return;
              run(() => deleteOption(option.id, setKey));
            }}
          >
            <Trash2 className="h-4 w-4" /> {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ColorPicker({ token, onPick }: { token: StatusToken; onPick: (token: StatusToken) => void }) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="shrink-0 rounded-full p-0.5 hover:bg-surface-raised" aria-label={t("settings.options.color")}>
        <ColorDot token={token} className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1.5">
          {CHIP_TOKENS.map((tk) => (
            <button
              key={tk}
              type="button"
              className="rounded-full p-1 hover:bg-surface-raised"
              onClick={() => {
                onPick(tk);
                setOpen(false);
              }}
            >
              <ColorDot token={tk} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
