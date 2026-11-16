import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { directReports, getOpenCycle, goalsFor, reviewStatus } from "@/lib/queries";
import { Empty, Flash, Status, type SearchParams } from "@/components/ui";

export default async function Team({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMe();
  const cycle = await getOpenCycle();
  const team = await Promise.all(
    (await directReports(me.id)).map(async (e) => ({
      e,
      goals: cycle ? await goalsFor(e.id, cycle.id) : [],
      status: cycle ? await reviewStatus(e.id, cycle.id) : null,
    })),
  );

  return (
    <div className="space-y-6">
      <h1 className="h1">My Team</h1>
      <Flash searchParams={searchParams} />
      {team.length === 0 ? (
        <Empty>Nobody reports to you, so there is no team to show.</Empty>
      ) : (
        <section className="card overflow-x-auto">
          {!cycle && <p className="mb-3 text-sm text-slate-600">No review cycle is open right now.</p>}
          <table className="tbl">
            <thead><tr><th>Name</th><th>Designation</th><th>Goals</th><th>Review</th><th></th></tr></thead>
            <tbody>
              {team.map(({ e, goals, status }) => {
                const waiting = goals.filter((g) => g.status === "submitted").length;
                return (
                  <tr key={e.id}>
                    <td className="font-medium">{e.full_name}</td>
                    <td>{e.designation}</td>
                    <td>
                      {goals.filter((g) => g.status === "approved").length}/{goals.length} approved
                      {waiting > 0 && <div className="text-xs text-blue-700">{waiting} waiting for you</div>}
                    </td>
                    <td>{status ? <Status value={status} /> : "-"}</td>
                    <td className="text-right"><Link href={`/team/${e.id}`} className="btn">Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
