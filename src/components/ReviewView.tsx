// Read-only view of a review: each goal with the self and manager comments.
import type { Goal, GoalRating, Review } from "@/lib/types";
import { Status, ratingText } from "./ui";

export function ReviewView({ goals, ratings, review, showManager }: {
  goals: Goal[];
  ratings: Record<number, GoalRating>;
  review: Review;
  showManager: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">Status: <Status value={review.status} /></div>
      {goals.map((g) => {
        const r = ratings[g.id];
        return (
          <div key={g.id} className="rounded-lg border border-slate-200 p-4">
            <div className="font-medium">{g.title} <span className="text-sm text-slate-500">({g.weightage}%)</span></div>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Self</div>
                <p className="text-sm">{r?.self_comment ?? "-"}</p>
                <p className="text-sm text-slate-600">{ratingText(r?.self_rating)}</p>
              </div>
              {showManager && (
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Manager</div>
                  <p className="text-sm">{r?.manager_comment ?? "-"}</p>
                  <p className="text-sm text-slate-600">{ratingText(r?.manager_rating)}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
        <div><span className="text-sm text-slate-500">Overall self-rating:</span> <b>{ratingText(review.overall_self_rating)}</b></div>
        {showManager && (
          <div>
            <span className="text-sm text-slate-500">Overall manager rating:</span> <b>{ratingText(review.overall_manager_rating)}</b>
            {review.manager_summary && <p className="mt-1 text-sm">{review.manager_summary}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
