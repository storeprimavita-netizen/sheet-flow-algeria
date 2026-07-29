"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LayoutGrid, Table2, Plus } from "lucide-react";
import { toast } from "sonner";

import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TaskForm } from "./task-form";
import { TaskKanban } from "./task-kanban";
import { TaskTable } from "./task-table";
import { TasksFilterBar } from "./tasks-filter-bar";

export type TaskRow = Tables<"tasks"> & {
  owner_name: string | null;
  meeting_title: string | null;
  product_name: string | null;
};

/**
 * Tasks: kanban-by-status is the default, list view is a URL-persisted
 * toggle. One `editing` state + sheet shared by both views and the "New
 * task" button, so there's a single create/edit surface (<TaskForm>).
 */
export function TasksView({
  rows,
  owners,
  meetings,
  products,
  currentUserId,
}: {
  rows: TaskRow[];
  owners: { user_id: string; display_name: string | null }[];
  meetings: { id: string; title: string; scheduled_at: string }[];
  products: { id: string; name: string; image?: string | null; status?: string | null }[];
  currentUserId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const table = sp.get("view") === "table";
  const [editing, setEditing] = React.useState<TaskRow | "new" | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  function setView(v: "kanban" | "table") {
    const next = new URLSearchParams(sp.toString());
    if (v === "table") next.set("view", "table");
    else next.delete("view");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function onDelete(id: string) {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    setBusyId(id);
    const { error } = await createClient().from("tasks").delete().eq("id", id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <TasksFilterBar owners={owners} products={products} currentUserId={currentUserId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex justify-start gap-1">
          <Button variant={table ? "outline" : "ghost"} size="sm" className="gap-1.5" onClick={() => setView("kanban")}>
            <LayoutGrid className="h-4 w-4" />
            {t("orders.viewKanban")}
          </Button>
          <Button variant={table ? "ghost" : "outline"} size="sm" className="gap-1.5" onClick={() => setView("table")}>
            <Table2 className="h-4 w-4" />
            {t("orders.viewTable")}
          </Button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> {t("tasks.new")}
        </Button>
      </div>

      {table ? (
        <TaskTable rows={rows} onEdit={setEditing} onDelete={onDelete} busyId={busyId} />
      ) : (
        <TaskKanban rows={rows} onEdit={setEditing} />
      )}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent>
          {editing !== null ? (
            <>
              <SheetTitle>{editing === "new" ? t("tasks.new") : t("actions.edit")}</SheetTitle>
              <div className="mt-4">
                <TaskForm
                  task={editing === "new" ? undefined : editing}
                  owners={owners}
                  meetings={meetings}
                  products={products}
                  onDone={() => setEditing(null)}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
