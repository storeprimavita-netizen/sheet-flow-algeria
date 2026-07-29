"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2, MoreHorizontal } from "lucide-react";

import { StatusSelect } from "@/components/status-select";
import { ColorDot, Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table/data-table";
import type { Column } from "@/components/data-table/types";
import { formatDate } from "@/lib/format";
import { TASK_PRIORITY_TOKEN } from "@/lib/statuses";
import { TaskOwnerAvatar } from "./task-owner-avatar";
import { updateTaskStatus } from "./actions";
import { isLegal, isOverdue } from "./task-utils";
import type { TaskRow } from "./tasks-view";

export function TaskTable({
  rows,
  onEdit,
  onDelete,
  busyId,
}: {
  rows: TaskRow[];
  onEdit: (row: TaskRow) => void;
  onDelete: (id: string) => void;
  busyId: string | null;
}) {
  const t = useTranslations();

  async function advance(id: string, from: string, to: string) {
    if (!isLegal(from, to)) {
      toast.error(t("orders.illegalTransition"));
      return;
    }
    const res = await updateTaskStatus(id, to);
    if (!res.ok) toast.error(res.error);
  }

  const columns: Column<TaskRow>[] = [
    { id: "title", header: t("fields.title"), sticky: true, sortable: true, cell: (r) => <span className="font-medium">{r.title}</span> },
    {
      id: "owner",
      header: t("fields.agent"),
      cell: (r) => (
        <span className="flex items-center gap-2">
          <TaskOwnerAvatar name={r.owner_name} />
          <span className="truncate text-xs text-muted-foreground">{r.owner_name ?? "—"}</span>
        </span>
      ),
    },
    {
      id: "priority",
      header: t("fields.priority"),
      align: "center",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <ColorDot token={TASK_PRIORITY_TOKEN[r.priority]} />
          {t(`status.task_priority.${r.priority}`)}
        </span>
      ),
    },
    {
      id: "due_date",
      header: t("fields.due_date"),
      sortable: true,
      cell: (r) => (r.due_date ? <span className={isOverdue(r) ? "text-danger" : undefined}>{formatDate(r.due_date)}</span> : "—"),
    },
    {
      id: "status",
      header: t("fields.status"),
      align: "center",
      cell: (r) => (
        <StatusSelect kind="task" value={r.status} onChange={(v) => advance(r.id, r.status, v)} className="w-auto min-w-[8.5rem]" />
      ),
    },
    {
      id: "meeting",
      header: t("team.meeting"),
      defaultHidden: true,
      cell: (r) =>
        r.meeting_title ? (
          <Link href={`/app/team/meetings/${r.meeting_id}`}>
            <Chip token="info" size="sm">
              {r.meeting_title}
            </Chip>
          </Link>
        ) : (
          "—"
        ),
    },
    { id: "product", header: t("fields.product"), defaultHidden: true, cell: (r) => r.product_name ?? "—" },
  ];

  return (
    <DataTable<TaskRow>
      tableId="team-tasks"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={{ title: t("tasks.none") }}
      rowActions={(r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t("actions.edit")} className="rounded p-1 hover:bg-surface-raised">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(r)}>
              <Pencil className="h-4 w-4" /> {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDelete(r.id)} disabled={busyId === r.id} className="text-danger">
              <Trash2 className="h-4 w-4" /> {t("actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
}
