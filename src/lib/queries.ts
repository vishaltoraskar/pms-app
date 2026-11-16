// Read-only helpers shared by pages and actions.
import { all, get } from "./db";
import type { Cycle, Employee, Goal, GoalRating, Review, ReviewStatus } from "./types";

export const getOpenCycle = () => get<Cycle>("SELECT * FROM review_cycles WHERE status = 'open'");
export const getCycle = (id: number) => get<Cycle>("SELECT * FROM review_cycles WHERE id = $1", id || 0);
export const getEmployee = (id: number) => get<Employee>("SELECT * FROM employees WHERE id = $1", id || 0);

export const directReports = (managerId: number) =>
  all<Employee>("SELECT * FROM employees WHERE manager_id = $1 AND is_active = 1 ORDER BY full_name", managerId);

// A manager is simply an employee who has at least one active direct report.
export const isManager = async (id: number) =>
  !!(await get("SELECT 1 AS x FROM employees WHERE manager_id = $1 AND is_active = 1 LIMIT 1", id));

export const goalsFor = (employeeId: number, cycleId: number) =>
  all<Goal>("SELECT * FROM goals WHERE employee_id = $1 AND cycle_id = $2 ORDER BY id", employeeId, cycleId);

export const reviewFor = (employeeId: number, cycleId: number) =>
  get<Review>("SELECT * FROM reviews WHERE employee_id = $1 AND cycle_id = $2", employeeId, cycleId);

export const reviewStatus = async (employeeId: number, cycleId: number): Promise<ReviewStatus> =>
  (await reviewFor(employeeId, cycleId))?.status ?? "not_started";

// goal_id -> rating row, for one review
export async function ratingsFor(reviewId: number) {
  const map: Record<number, GoalRating> = {};
  for (const r of await all<GoalRating>("SELECT * FROM goal_ratings WHERE review_id = $1", reviewId)) map[r.goal_id] = r;
  return map;
}

export const totalWeight = (goals: Goal[]) => goals.reduce((sum, g) => sum + g.weightage, 0);

export const isEditable = (g: Goal) => g.status === "draft" || g.status === "sent_back";

// One short sentence telling an employee what to do next in the cycle.
export function nextStep(goals: Goal[], status: ReviewStatus) {
  if (status === "completed") return "Your review is complete.";
  if (status === "manager_reviewed") return "Your manager has reviewed you and is finalising it.";
  if (status === "self_submitted") return "Self-appraisal submitted. Waiting for your manager's review.";
  if (goals.length === 0) return "Add your goals. Weightages must total 100.";
  if (goals.some(isEditable)) return "Finish your goals and submit them for approval.";
  if (goals.some((g) => g.status === "submitted")) return "Waiting for your manager to approve your goals.";
  return "All goals approved. Complete your self-appraisal.";
}
