// The shapes of the rows in our five tables (plus the demo email outbox).

// Only HR Admin is stored. "Manager" is worked out: anyone with direct reports.
export type Role = "employee" | "hr_admin";

export type Employee = {
  id: number;
  clerk_user_id: string | null;
  full_name: string;
  email: string;
  designation: string;
  department: string;
  date_of_joining: string;
  manager_id: number | null;
  role: Role;
  is_active: number;
};

export type CycleStatus = "draft" | "open" | "closed";
export type Cycle = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  created_by: number | null;
};

export type GoalStatus = "draft" | "submitted" | "approved" | "sent_back";
export type Goal = {
  id: number;
  employee_id: number;
  cycle_id: number;
  title: string;
  description: string;
  weightage: number;
  target_date: string;
  status: GoalStatus;
  manager_comment: string | null;
};

export type ReviewStatus = "not_started" | "self_submitted" | "manager_reviewed" | "completed";
export type Review = {
  id: number;
  employee_id: number;
  manager_id: number | null;
  cycle_id: number;
  status: ReviewStatus;
  overall_self_rating: number | null;
  overall_manager_rating: number | null;
  manager_summary: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export type GoalRating = {
  id: number;
  review_id: number;
  goal_id: number;
  self_comment: string | null;
  self_rating: number | null;
  manager_comment: string | null;
  manager_rating: number | null;
};

export type Email = {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  sent_via: string;
  created_at: string;
};

// 5-point rating scale used for self and manager ratings.
export const RATINGS: Record<number, string> = {
  1: "1 - Needs improvement",
  2: "2 - Below expectations",
  3: "3 - Meets expectations",
  4: "4 - Exceeds expectations",
  5: "5 - Outstanding",
};
