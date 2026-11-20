import { notFound } from "next/navigation";

/** Unmatched /app/** URLs reach the app not-found (role-home link) instead of the global 404. */
export default function UnmatchedAppRoute() {
  notFound();
}
