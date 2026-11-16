import Link from "next/link";
import { requireHr } from "@/lib/auth";
import { all } from "@/lib/db";
import type { Cycle } from "@/lib/types";
import { Empty, Flash, Status, one, ratingText, type SearchParams } from "@/components/ui";
import { reportRows } from "./data";

export default async function Report({ searchParams }: { searchParams: SearchParams }) {
  await requireHr();
  const cycles = await all<Cycle>("SELECT * FROM review_cycles WHERE status != 'draft' ORDER BY start_date DESC");
  const chosen = Number(one((await searchParams).cycle));
  const cycle = cycles.find((c) => c.id === chosen) ?? cycles.find((c) => c.status === "open") ?? cycles[0];

  if (!cycle) {
    return (
      <div>
        <h1 className="h1">Completion report</h1>
        <Empty href="/admin/cycles" cta="Go to Cycles">No cycle has been opened yet, so there is nothing to report.</Empty>
      </div>
    );
  }

  const rows = await reportRows(cycle.id);
  const done = rows.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <h1 className="h1">Completion report</h1>
      <Flash searchParams={searchParams} />
      <div className="flex flex-wrap items-center gap-2">
        {cycles.map((c) => (
          <Link key={c.id} href={`/admin/report?cycle=${c.id}`}
            className={`btn ${c.id === cycle.id ? "btn-primary" : ""}`}>{c.name}</Link>
        ))}
        <a href={`/admin/report/csv?cycle=${cycle.id}`} className="btn ml-auto">Download CSV</a>
      </div>
      <p className="text-sm text-slate-600">{done} of {rows.length} employees completed in {cycle.name}.</p>
      <section className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Department</th><th>Manager</th><th>Goals approved</th><th>Status</th><th>Self</th><th>Manager rating</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/team/${r.id}`} className="text-indigo-700">{r.full_name}</Link></td>
                <td>{r.department}</td>
                <td>{r.manager ?? "-"}</td>
                <td>{r.approved_goals}/{r.goals}</td>
                <td><Status value={r.status} /></td>
                <td className="whitespace-nowrap">{ratingText(r.overall_self_rating)}</td>
                <td className="whitespace-nowrap">{ratingText(r.overall_manager_rating)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
