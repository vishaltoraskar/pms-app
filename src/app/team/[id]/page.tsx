import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getEmployee, getOpenCycle, goalsFor, ratingsFor, reviewFor } from "@/lib/queries";
import { Empty, Flash, RatingSelect, Status, ratingText, type SearchParams } from "@/components/ui";
import { ReviewView } from "@/components/ReviewView";
import { completeReview, decideGoal, saveManagerReview } from "../../actions";

export default async function ReviewEmployee({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const me = await requireMe();
  const emp = await getEmployee(Number((await params).id));

  // Server-side check: only this person's manager (or HR, read-only) may open this page.
  const isTheirManager = !!emp && emp.manager_id === me.id;
  const isHr = me.role === "hr_admin";
  if (!emp || (!isTheirManager && !isHr)) {
    return (
      <div>
        <h1 className="h1">Not allowed</h1>
        <Empty href="/dashboard" cta="Back to dashboard">You can only open reviews of people who report to you.</Empty>
      </div>
    );
  }

  const cycle = await getOpenCycle();
  const goals = cycle ? await goalsFor(emp.id, cycle.id) : [];
  const approved = goals.filter((g) => g.status === "approved");
  const review = cycle ? await reviewFor(emp.id, cycle.id) : undefined;
  const ratings = review ? await ratingsFor(review.id) : {};
  const canReview = isTheirManager && (review?.status === "self_submitted" || review?.status === "manager_reviewed");

  return (
    <div className="space-y-6">
      <div>
        <Link href={isTheirManager ? "/team" : "/admin/report"} className="text-sm text-indigo-700">&larr; Back</Link>
        <h1 className="h1 mb-1 mt-2">{emp.full_name}</h1>
        <p className="text-sm text-slate-500">{emp.designation}, {emp.department}{cycle && ` · ${cycle.name}`}</p>
      </div>
      <Flash searchParams={searchParams} />
      {!cycle && <Empty>No review cycle is open right now.</Empty>}

      {cycle && (
        <section className="card">
          <h2 className="h2">Goals</h2>
          {goals.length === 0 ? (
            <p className="text-sm text-slate-600">{emp.full_name} has not added any goals yet.</p>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => (
                <div key={g.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{g.title} <span className="text-sm text-slate-500">({g.weightage}%, by {g.target_date})</span></div>
                      {g.description && <p className="text-sm text-slate-500">{g.description}</p>}
                      {g.manager_comment && <p className="mt-1 text-xs text-amber-800">Your comment: {g.manager_comment}</p>}
                    </div>
                    <Status value={g.status} />
                  </div>
                  {isTheirManager && g.status === "submitted" && (
                    <form action={decideGoal} className="mt-3 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={g.id} />
                      <input name="comment" placeholder="Comment (required to send back)" className="input flex-1" />
                      <button name="decision" value="approve" className="btn btn-primary">Approve</button>
                      <button name="decision" value="send_back" className="btn btn-danger">Send back</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {cycle && (
        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2 mb-0">Review</h2>
            <Status value={review?.status ?? "not_started"} />
          </div>

          {!review || review.status === "not_started" ? (
            <p className="text-sm text-slate-600">Waiting for {emp.full_name} to submit their self-appraisal.</p>
          ) : canReview ? (
            <form action={saveManagerReview} className="space-y-4">
              <input type="hidden" name="employee_id" value={emp.id} />
              {approved.map((g) => {
                const r = ratings[g.id];
                return (
                  <div key={g.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 font-medium">{g.title} <span className="text-sm text-slate-500">({g.weightage}%)</span></div>
                    {/* Self-appraisal on the left, manager input on the right */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold uppercase text-slate-500">Employee says</div>
                        <p className="text-sm">{r?.self_comment}</p>
                        <p className="mt-1 text-sm text-slate-600">{ratingText(r?.self_rating)}</p>
                      </div>
                      <div className="space-y-2">
                        <textarea name={`comment_${g.id}`} required rows={3} defaultValue={r?.manager_comment ?? ""}
                          placeholder="Your comment" className="input" />
                        <RatingSelect name={`rating_${g.id}`} defaultValue={r?.manager_rating} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="label">Employee&apos;s overall self-rating</p>
                  <p className="text-sm">{ratingText(review.overall_self_rating)}</p>
                </div>
                <div className="space-y-2">
                  <label className="label">Overall rating</label>
                  <RatingSelect name="overall" defaultValue={review.overall_manager_rating} />
                  <label className="label">Summary</label>
                  <textarea name="summary" required rows={3} defaultValue={review.manager_summary ?? ""} className="input" />
                </div>
              </div>
              <button className="btn btn-primary">Save review</button>
            </form>
          ) : (
            <ReviewView goals={approved} ratings={ratings} review={review} showManager />
          )}

          {isTheirManager && review?.status === "manager_reviewed" && (
            <form action={completeReview} className="mt-4 border-t border-slate-200 pt-4">
              <input type="hidden" name="employee_id" value={emp.id} />
              <button className="btn btn-primary">Complete review</button>
              <span className="ml-3 text-xs text-slate-500">After this the employee can see your ratings.</span>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
