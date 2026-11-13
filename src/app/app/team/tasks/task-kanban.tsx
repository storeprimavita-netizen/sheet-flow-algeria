"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

import { StatusPill } from "@/components/status-pill";
import { StatusSelect } from "@/components/status-select";
import { ColorDot } from "@/components/ui/chip";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/format";
import { TASK_STATUSES } from "@/lib/enums";
import { TASK_PRIORITY_TOKEN } from "@/lib/statuses";
import { TaskOwnerAvatar } from "./task-owner-avatar";
import { updateTaskStatus } from "./actions";
import { isLegal, isOverdue } from "./task-utils";
import type { TaskRow } from "./tasks-view";

/**
 * Tasks kanban (default view). Columns are the task statuses; cards move by
 * native drag OR the on-card <StatusSelect> (keyboard-accessible equivalent).
 * Only legal transitions accepted. Optimistic move, rollback on failure.
 */
export function TaskKanban({ rows, onEdit }: { rows: TaskRow[]; onEdit: (row: TaskRow) => void }) {
  const t = useTranslations();
  const [items, setItems] = React.useState(rows);
  React.useEffect(() => setItems(rows), [rows]);
  const [dragId, setDragId] = React.useState<string | null>(null);

  async function move(id: string, to: string) {
    const card = items.find((r) => r.id === id);
    if (!card || card.status === to) return;
    if (!isLegal(card.status, to)) {
      toast.error(t("orders.illegalTransition"));
      return;
    }
    const prev = card.status;
    const toStatus = to as TaskRow["status"];
    setItems((list) => list.map((r) => (r.id === id ? { ...r, status: toStatus } : r)));
    const res = await updateTaskStatus(id, to);
    if (!res.ok) {
      setItems((list) => list.map((r) => (r.id === id ? { ...r, status: prev } : r)));
      toast.error(res.error);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {TASK_STATUSES.map((status) => {
        const col = items.filter((r) => r.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) move(dragId, status);
              setDragId(null);
            }}
            className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-surface p-2"
          >
            <div className="flex items-center justify-between px-1">
              <StatusPill kind="task" status={status} size="sm" />
              <span className="num text-xs text-muted-foreground">{col.length}</span>
            </div>
            {col.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">{t("orders.kanbanEmpty")}</p>
            ) : (
              col.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onEdit(r)}
                  className="card-surface cursor-pointer space-y-2 rounded-lg p-3 text-sm hover:bg-surface-raised"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{r.title}</span>
                    <ColorDot token={TASK_PRIORITY_TOKEN[r.priority]} className="mt-1 shrink-0" />
                  </div>
                  {r.product_name ? <div className="truncate text-xs text-muted-foreground">{r.product_name}</div> : null}
                  {r.meeting_title ? (
                    <Link
                      href={`/app/team/meetings/${r.meeting_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block"
                    >
                      <Chip token="info" size="sm">
                        {r.meeting_title}
                      </Chip>
                    </Link>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <TaskOwnerAvatar name={r.owner_name} />
                    {r.due_date ? (
                      <span className={`flex items-center gap-1 text-xs ${isOverdue(r) ? "text-danger" : "text-muted-foreground"}`}>
                        <CalendarClock className="h-3 w-3" />
                        {formatDate(r.due_date)}
                      </span>
                    ) : null}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <StatusSelect kind="task" value={r.status} onChange={(v) => move(r.id, v)} className="w-full" />
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
