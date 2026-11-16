import { requireHr } from "@/lib/auth";
import { all } from "@/lib/db";
import type { Cycle } from "@/lib/types";
import { Empty, Flash, Status, type SearchParams } from "@/components/ui";
import { createCycle, setCycleStatus } from "../../actions";

export default async function Cycles({ searchParams }: { searchParams: SearchParams }) {
  await requireHr();
  const cycles = await all<Cycle>("SELECT * FROM review_cycles ORDER BY start_date DESC");

  return (
    <div className="space-y-6">
      <h1 className="h1">Review cycles</h1>
      <Flash searchParams={searchParams} />
      <p className="text-sm text-slate-600">A cycle moves Draft → Open → Closed. Only one cycle can be open at a time.</p>

      <section className="card overflow-x-auto">
        {cycles.length === 0 ? (
          <Empty>No cycles yet. Create one below.</Empty>
        ) : (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Dates</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="whitespace-nowrap">{c.start_date} to {c.end_date}</td>
                  <td><Status value={c.status} /></td>
                  <td className="text-right">
                    {c.status !== "closed" && (
                      <form action={setCycleStatus}>
                        <input type="hidden" name="id" value={c.id} />
                        {c.status === "draft"
                          ? <button name="status" value="open" className="btn btn-primary">Open</button>
                          : <button name="status" value="closed" className="btn btn-danger">Close</button>}
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Create a cycle</h2>
        <form action={createCycle} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Name</label>
            <input name="name" required placeholder="FY 2027-28 Annual" className="input" />
          </div>
          <div>
            <label className="label">Start date</label>
            <input name="start_date" type="date" required className="input" />
          </div>
          <div>
            <label className="label">End date</label>
            <input name="end_date" type="date" required className="input" />
          </div>
          <div><button className="btn btn-primary">Create as Draft</button></div>
        </form>
      </section>
    </div>
  );
}
