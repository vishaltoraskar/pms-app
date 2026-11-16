import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { all } from "@/lib/db";
import { getCycle, getOpenCycle, goalsFor, ratingsFor, reviewFor } from "@/lib/queries";
import type { Cycle, Review } from "@/lib/types";
import { Empty, Flash, RatingSelect, Status, one, type SearchParams } from "@/components/ui";
import { ReviewView } from "@/components/ReviewView";
import { submitSelfAppraisal } from "../actions";

export default async function MyReview({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMe();
  const cycleParam = Number(one((await searchParams).cycle));
  const cycle = cycleParam ? await getCycle(cycleParam) : await getOpenCycle();

  // Always filtered by MY id, so changing ?cycle= in the URL can never show someone else's review.
  const history = await all<Review & { cycle_name: string }>(
    `SELECT r.*, c.name AS cycle_name FROM reviews r JOIN review_cycles c ON c.id = r.cycle_id
     WHERE r.employee_id = $1 ORDER BY c.start_date DESC`, me.id);

  return (
    <div className="space-y-6">
      <h1 className="h1">My Review</h1>
      <Flash searchParams={searchParams} />
      {cycle ? <CycleReview meId={me.id} cycle={cycle} /> : <Empty>No review cycle is open right now.</Empty>}

      <section className="card">
        <h2 className="h2">My review history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">No reviews yet. Your reviews will be listed here, cycle by cycle.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <Link href={`/review?cycle=${r.cycle_id}`} className="text-indigo-700">{r.cycle_name}</Link>
                <Status value={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function CycleReview({ meId, cycle }: { meId: number; cycle: Cycle }) {
  const goals = await goalsFor(meId, cycle.id);
  const approved = goals.filter((g) => g.status === "approved");
  const review = await reviewFor(meId, cycle.id);

  // Already submitted: show it read-only. The manager's part is shown once the review is completed.
  if (review && review.status !== "not_started") {
    return (
      <section className="card">
        <h2 className="h2">{cycle.name}</h2>
        <ReviewView goals={approved} ratings={await ratingsFor(review.id)} review={review} showManager={review.status === "completed"} />
      </section>
    );
  }
  if (cycle.status !== "open") return <Empty>You did not submit a review in {cycle.name}.</Empty>;
  if (goals.length === 0 || approved.length !== goals.length) {
    return (
      <Empty href="/goals" cta="Go to My Goals">
        Your self-appraisal opens once all your goals are approved by your manager
        ({approved.length} of {goals.length} approved).
      </Empty>
    );
  }

  return (
    <section className="card">
      <h2 className="h2">Self-appraisal: {cycle.name}</h2>
      <p className="mb-4 text-sm text-slate-600">For each goal, write what you achieved and rate yourself. You can&apos;t edit it after submitting.</p>
      <form action={submitSelfAppraisal} className="space-y-4">
        {approved.map((g) => (
          <div key={g.id} className="rounded-lg border border-slate-200 p-4">
            <div className="font-medium">{g.title} <span className="text-sm text-slate-500">({g.weightage}%)</span></div>
            {g.description && <p className="text-sm text-slate-500">{g.description}</p>}
            <label className="label mt-3">What did you achieve?</label>
            <textarea name={`comment_${g.id}`} required rows={3} className="input" />
            <label className="label mt-3">Self-rating</label>
            <RatingSelect name={`rating_${g.id}`} />
          </div>
        ))}
        <div>
          <label className="label">Overall self-rating</label>
          <RatingSelect name="overall" />
        </div>
        <button className="btn btn-primary">Submit self-appraisal</button>
      </form>
    </section>
  );
}
