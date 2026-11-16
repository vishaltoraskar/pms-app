import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { all } from "@/lib/db";
import { directReports, getOpenCycle, goalsFor, nextStep, reviewStatus, totalWeight } from "@/lib/queries";
import type { Employee, ReviewStatus } from "@/lib/types";
import { Empty, Flash, Status, type SearchParams } from "@/components/ui";

const STAGES: ReviewStatus[] = ["not_started", "self_submitted", "manager_reviewed", "completed"];

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMe();
  const cycle = await getOpenCycle();
  if (!cycle) {
    return (
      <div className="space-y-6">
        <h1 className="h1">Hello, {me.full_name.split(" ")[0]}</h1>
        <Flash searchParams={searchParams} />
        <Empty>No review cycle is open right now. {me.role === "hr_admin" ? "Open one from Cycles." : "HR will open one soon."}</Empty>
      </div>
    );
  }

  // Everyone: my own progress
  const myGoals = await goalsFor(me.id, cycle.id);
  const myStatus = await reviewStatus(me.id, cycle.id);

  // Managers: each direct report's goals and review status
  const team = await Promise.all(
    (await directReports(me.id)).map(async (e) => ({
      e,
      goals: await goalsFor(e.id, cycle.id),
      status: await reviewStatus(e.id, cycle.id),
    })),
  );

  // HR: every active employee's review status
  const company = me.role === "hr_admin"
    ? await Promise.all(
        (await all<Employee>("SELECT * FROM employees WHERE is_active = 1")).map((e) => reviewStatus(e.id, cycle.id)),
      )
    : [];

  return (
    <div className="space-y-6">
      <h1 className="h1">Hello, {me.full_name.split(" ")[0]}</h1>
      <Flash searchParams={searchParams} />

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2 mb-0">My progress: {cycle.name}</h2>
          <Status value={myStatus} />
        </div>
        <p className="mt-3 text-slate-700">{nextStep(myGoals, myStatus)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {myGoals.length} goals, total weightage {totalWeight(myGoals)} / 100, {myGoals.filter((g) => g.status === "approved").length} approved
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/goals" className="btn">My Goals</Link>
          <Link href="/review" className="btn">My Review</Link>
        </div>
      </section>

      {team.length > 0 && (
        <section className="card">
          <h2 className="h2">My team</h2>
          <Completion statuses={team.map((t) => t.status)} />
          <div className="overflow-x-auto">
            <table className="tbl mt-4">
              <thead><tr><th>Name</th><th>Goals</th><th>Review</th><th></th></tr></thead>
              <tbody>
                {team.map(({ e, goals, status }) => {
                  const waiting = goals.filter((g) => g.status === "submitted").length;
                  return (
                    <tr key={e.id}>
                      <td>{e.full_name}</td>
                      <td>{goals.length} goals{waiting > 0 && <span className="ml-1 text-blue-700">({waiting} to approve)</span>}</td>
                      <td><Status value={status} /></td>
                      <td className="text-right"><Link href={`/team/${e.id}`} className="text-indigo-700">Open</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {me.role === "hr_admin" && (
        <section className="card">
          <h2 className="h2">Company-wide ({cycle.name})</h2>
          <Completion statuses={company} />
          <Link href="/admin/report" className="btn mt-4">Open completion report</Link>
        </section>
      )}
    </div>
  );
}

function Completion({ statuses }: { statuses: ReviewStatus[] }) {
  const done = statuses.filter((s) => s === "completed").length;
  const pct = statuses.length ? Math.round((done / statuses.length) * 100) : 0;
  return (
    <div>
      <p className="text-sm text-slate-600">{done} of {statuses.length} completed ({pct}%)</p>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {STAGES.map((s) => (
          <span key={s} className="flex items-center gap-1"><Status value={s} /> {statuses.filter((x) => x === s).length}</span>
        ))}
      </div>
    </div>
  );
}
