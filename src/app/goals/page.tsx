import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getOpenCycle, goalsFor, isEditable, reviewStatus, totalWeight } from "@/lib/queries";
import { Empty, Flash, Status, one, type SearchParams } from "@/components/ui";
import { deleteGoal, saveGoal, submitGoals } from "../actions";

export default async function Goals({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMe();
  const cycle = await getOpenCycle();
  if (!cycle) {
    return (
      <div>
        <h1 className="h1">My Goals</h1>
        <Empty>No review cycle is open, so goals can&apos;t be added yet. HR will open one.</Empty>
      </div>
    );
  }

  const goals = await goalsFor(me.id, cycle.id);
  const total = totalWeight(goals);
  const locked = (await reviewStatus(me.id, cycle.id)) !== "not_started";
  const editId = Number(one((await searchParams).edit));
  const editing = goals.find((g) => g.id === editId && isEditable(g));
  const canSubmit = !locked && goals.some(isEditable);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1 mb-1">My Goals</h1>
        <p className="text-sm text-slate-500">{cycle.name} ({cycle.start_date} to {cycle.end_date})</p>
      </div>
      <Flash searchParams={searchParams} />

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2 mb-0">Goals</h2>
          <span className={`text-sm font-medium ${total === 100 ? "text-green-700" : "text-amber-700"}`}>
            Total weightage: {total} / 100
          </span>
        </div>
        {goals.length === 0 ? (
          <p className="text-slate-600">You have no goals yet. Add your first goal below. Aim for 3 to 5 goals.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Goal</th><th>Weight</th><th>Target</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div className="font-medium">{g.title}</div>
                      {g.description && <div className="text-xs text-slate-500">{g.description}</div>}
                      {g.manager_comment && <div className="mt-1 text-xs text-amber-800">Manager: {g.manager_comment}</div>}
                    </td>
                    <td>{g.weightage}%</td>
                    <td className="whitespace-nowrap">{g.target_date}</td>
                    <td><Status value={g.status} /></td>
                    <td className="whitespace-nowrap text-right">
                      {!locked && isEditable(g) && (
                        <div className="flex justify-end gap-2">
                          <Link href={`/goals?edit=${g.id}`} className="btn">Edit</Link>
                          <form action={deleteGoal}>
                            <input type="hidden" name="id" value={g.id} />
                            <button className="btn btn-danger">Delete</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canSubmit && (
          <form action={submitGoals} className="mt-4">
            <button className="btn btn-primary">Submit goals for approval</button>
            <span className="ml-3 text-xs text-slate-500">Weightages must total exactly 100.</span>
          </form>
        )}
      </section>

      {!locked && (
        <section className="card">
          <h2 className="h2">{editing ? "Edit goal" : "Add a goal"}</h2>
          <form action={saveGoal} className="grid gap-4 sm:grid-cols-2" key={editing?.id ?? "new"}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input name="title" required maxLength={150} defaultValue={editing?.title} className="input"
                placeholder="e.g. Reduce bug reopen rate from 12% to 5% by December" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description (how will it be measured?)</label>
              <textarea name="description" rows={2} defaultValue={editing?.description} className="input" />
            </div>
            <div>
              <label className="label">Weightage (%)</label>
              <input name="weightage" type="number" min={1} max={100} step={1} required
                defaultValue={editing?.weightage} className="input" />
            </div>
            <div>
              <label className="label">Target date</label>
              <input name="target_date" type="date" required min={cycle.start_date} max={cycle.end_date}
                defaultValue={editing?.target_date} className="input" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn btn-primary">{editing ? "Save changes" : "Add goal"}</button>
              {editing && <Link href="/goals" className="btn">Cancel</Link>}
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
