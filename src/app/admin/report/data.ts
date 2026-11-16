// Rows for the completion report (used by the page and the CSV download).
import { all } from "@/lib/db";
import type { ReviewStatus } from "@/lib/types";

export type ReportRow = {
  id: number;
  full_name: string;
  department: string;
  manager: string | null;
  goals: number;
  approved_goals: number;
  status: ReviewStatus;
  overall_self_rating: number | null;
  overall_manager_rating: number | null;
};

export function reportRows(cycleId: number) {
  return all<ReportRow>(
    `SELECT e.id, e.full_name, e.department, m.full_name AS manager,
       (SELECT COUNT(*)::int FROM goals g WHERE g.employee_id = e.id AND g.cycle_id = $1) AS goals,
       (SELECT COUNT(*)::int FROM goals g WHERE g.employee_id = e.id AND g.cycle_id = $1 AND g.status = 'approved') AS approved_goals,
       COALESCE(r.status, 'not_started') AS status, r.overall_self_rating, r.overall_manager_rating
     FROM employees e
     LEFT JOIN employees m ON m.id = e.manager_id
     LEFT JOIN reviews r ON r.employee_id = e.id AND r.cycle_id = $1
     WHERE e.is_active = 1
     ORDER BY e.department, e.full_name`,
    cycleId);
}
