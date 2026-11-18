import { transitionsFor } from "@/lib/statuses";
import type { TaskRow } from "./tasks-view";

export const isLegal = (from: string, to: string) => transitionsFor("task", from).some((d) => d.key === to);
export const isOverdue = (r: TaskRow) =>
  !!r.due_date && r.due_date < new Date().toISOString().slice(0, 10) && r.status !== "done";
