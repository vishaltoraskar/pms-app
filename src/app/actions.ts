"use server";
// Every form in the app posts to one of these server actions. Each action
// checks who is signed in and whether they are allowed, validates the input,
// writes to the database, then sends the user back to a page with a message.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get, now, run, transaction } from "@/lib/db";
import { COOKIE, clerkEnabled, requireHr, requireMe } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  getCycle, getEmployee, getOpenCycle, goalsFor, isEditable, reviewFor, totalWeight,
} from "@/lib/queries";
import type { Employee, Goal } from "@/lib/types";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string) => Number(str(fd, key));

// Go back to a page and show a red (error) or green (ok) message there.
function back(path: string, message: string, kind: "error" | "ok" = "error"): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`);
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isRating = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;

/* ---------- Sign in / out (demo mode only; Clerk handles this when its keys are set) ---------- */

export async function signIn(fd: FormData) {
  if (clerkEnabled) back("/sign-in", "Please sign in with Clerk.");
  const id = num(fd, "id");
  if (!(await get("SELECT 1 AS x FROM employees WHERE id = $1 AND is_active = 1", id || 0))) back("/sign-in", "Unknown user.");
  (await cookies()).set(COOKIE, String(id), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
  redirect("/");
}

/* ---------- Employees (HR Admin) ---------- */

export async function saveEmployee(fd: FormData) {
  await requireHr();
  const id = num(fd, "id") || 0;
  const page = id ? `/admin/employees?edit=${id}` : "/admin/employees";
  const e = {
    full_name: str(fd, "full_name"),
    email: str(fd, "email").toLowerCase(),
    designation: str(fd, "designation"),
    department: str(fd, "department"),
    date_of_joining: str(fd, "date_of_joining"),
    manager_id: num(fd, "manager_id") || null,
    role: str(fd, "role") === "hr_admin" ? "hr_admin" : "employee",
    is_active: id ? (fd.get("is_active") ? 1 : 0) : 1,
  };

  if (!e.full_name || !e.designation || !e.department) back(page, "Name, designation and department are required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) back(page, "Enter a valid email address.");
  if (!isDate(e.date_of_joining)) back(page, "Enter a valid date of joining.");
  if (await get("SELECT 1 AS x FROM employees WHERE email = $1 AND id != $2", e.email, id))
    back(page, "Another employee already uses this email.");

  if (e.manager_id) {
    if (!(await getEmployee(e.manager_id))) back(page, "Chosen manager does not exist.");
    // Walk up the chain from the new manager: we must never reach this employee again.
    let cursor: number | null = e.manager_id;
    while (cursor) {
      if (cursor === id) back(page, "That manager would create a loop in the reporting line.");
      cursor = (await getEmployee(cursor))?.manager_id ?? null;
    }
  }

  if (id) {
    await run(`UPDATE employees SET full_name=$1, email=$2, designation=$3, department=$4, date_of_joining=$5,
               manager_id=$6, role=$7, is_active=$8 WHERE id=$9`,
      e.full_name, e.email, e.designation, e.department, e.date_of_joining, e.manager_id, e.role, e.is_active, id);
    back("/admin/employees", `Saved ${e.full_name}.`, "ok");
  }
  await run(`INSERT INTO employees (full_name, email, designation, department, date_of_joining, manager_id, role)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    e.full_name, e.email, e.designation, e.department, e.date_of_joining, e.manager_id, e.role);
  back("/admin/employees", `Added ${e.full_name}.`, "ok");
}

/* ---------- Review cycles (HR Admin) ---------- */

export async function createCycle(fd: FormData) {
  const me = await requireHr();
  const name = str(fd, "name");
  const start = str(fd, "start_date");
  const end = str(fd, "end_date");
  if (!name) back("/admin/cycles", "Cycle name is required.");
  if (!isDate(start) || !isDate(end)) back("/admin/cycles", "Enter valid start and end dates.");
  if (end <= start) back("/admin/cycles", "End date must be after the start date.");
  await run("INSERT INTO review_cycles (name, start_date, end_date, status, created_by) VALUES ($1, $2, $3, 'draft', $4)",
    name, start, end, me.id);
  back("/admin/cycles", `Created "${name}" as Draft.`, "ok");
}

export async function setCycleStatus(fd: FormData) {
  await requireHr();
  const cycle = await getCycle(num(fd, "id"));
  const to = str(fd, "status");
  if (!cycle) back("/admin/cycles", "Cycle not found.");
  if (to === "open") {
    if (cycle.status !== "draft") back("/admin/cycles", "Only a Draft cycle can be opened.");
    const open = await getOpenCycle();
    if (open) back("/admin/cycles", `Close "${open.name}" first. Only one cycle can be open at a time.`);
  } else if (to === "closed") {
    if (cycle.status !== "open") back("/admin/cycles", "Only an Open cycle can be closed.");
  } else {
    back("/admin/cycles", "Unknown status.");
  }
  await run("UPDATE review_cycles SET status = $1 WHERE id = $2", to, cycle.id);
  back("/admin/cycles", `"${cycle.name}" is now ${to === "open" ? "Open" : "Closed"}.`, "ok");
}

/* ---------- Goals (employee, for themselves) ---------- */

export async function saveGoal(fd: FormData) {
  const me = await requireMe();
  const cycle = await getOpenCycle();
  if (!cycle) back("/goals", "There is no open review cycle.");
  const id = num(fd, "id") || 0;
  const page = id ? `/goals?edit=${id}` : "/goals";
  const status = (await reviewFor(me.id, cycle.id))?.status ?? "not_started";
  if (status !== "not_started") back("/goals", "Your self-appraisal is already submitted, so goals are locked.");

  const title = str(fd, "title");
  const description = str(fd, "description");
  const weightage = Number(str(fd, "weightage"));
  const target = str(fd, "target_date");
  if (!title) back(page, "Goal title is required.");
  if (title.length > 150) back(page, "Keep the title under 150 characters.");
  if (!Number.isInteger(weightage) || weightage < 1 || weightage > 100) back(page, "Weightage must be a whole number from 1 to 100.");
  if (!isDate(target)) back(page, "Enter a valid target date.");
  if (target < cycle.start_date || target > cycle.end_date)
    back(page, `Target date must be inside the cycle (${cycle.start_date} to ${cycle.end_date}).`);

  if (id) {
    // Only your own goal, in this cycle, and only while it is Draft or Sent back.
    const goal = await get<Goal>("SELECT * FROM goals WHERE id = $1 AND employee_id = $2 AND cycle_id = $3", id, me.id, cycle.id);
    if (!goal || !isEditable(goal)) back("/goals", "This goal can't be edited.");
    await run("UPDATE goals SET title=$1, description=$2, weightage=$3, target_date=$4 WHERE id=$5",
      title, description, weightage, target, id);
    back("/goals", "Goal updated.", "ok");
  }
  await run(`INSERT INTO goals (employee_id, cycle_id, title, description, weightage, target_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'draft')`, me.id, cycle.id, title, description, weightage, target);
  back("/goals", "Goal added as Draft.", "ok");
}

export async function deleteGoal(fd: FormData) {
  const me = await requireMe();
  const goal = await get<Goal>("SELECT * FROM goals WHERE id = $1 AND employee_id = $2", num(fd, "id") || 0, me.id);
  if (!goal || !isEditable(goal)) back("/goals", "This goal can't be deleted.");
  await run("DELETE FROM goals WHERE id = $1", goal.id);
  back("/goals", "Goal deleted.", "ok");
}

export async function submitGoals() {
  const me = await requireMe();
  const cycle = await getOpenCycle();
  if (!cycle) back("/goals", "There is no open review cycle.");
  const goals = await goalsFor(me.id, cycle.id);
  if (!goals.some(isEditable)) back("/goals", "There are no Draft goals to submit.");
  const total = totalWeight(goals);
  if (total !== 100) back("/goals", `Weightages add up to ${total}. They must total exactly 100.`);
  if (!me.manager_id) back("/goals", "You don't have a manager yet. Ask HR to set one.");

  await run(`UPDATE goals SET status = 'submitted' WHERE employee_id = $1 AND cycle_id = $2
             AND status IN ('draft','sent_back')`, me.id, cycle.id);

  const manager = await getEmployee(me.manager_id);
  if (manager) {
    await sendEmail(manager.email, `${me.full_name} submitted goals for approval`,
      `${me.full_name} has submitted goals for ${cycle.name}. Please approve or send them back.`, `/team/${me.id}`);
  }
  back("/goals", "Goals submitted to your manager for approval.", "ok");
}

/* ---------- Goal approval (manager) ---------- */

// Loads an employee only if the signed-in user is their manager.
async function requireMyReport(employeeId: number) {
  const me = await requireMe();
  const emp = await getEmployee(employeeId);
  if (!emp || emp.manager_id !== me.id) back("/team", "You can only act on your own direct reports.");
  return { me, emp: emp as Employee };
}

export async function decideGoal(fd: FormData) {
  const goal = await get<Goal>("SELECT * FROM goals WHERE id = $1", num(fd, "id") || 0);
  if (!goal) back("/team", "Goal not found.");
  const { emp } = await requireMyReport(goal.employee_id);
  const page = `/team/${emp.id}`;
  if (goal.status !== "submitted") back(page, "Only Submitted goals can be approved or sent back.");

  if (str(fd, "decision") === "approve") {
    await run("UPDATE goals SET status = 'approved', manager_comment = $1 WHERE id = $2", str(fd, "comment") || null, goal.id);
    back(page, `Approved "${goal.title}".`, "ok");
  }
  const comment = str(fd, "comment");
  if (!comment) back(page, "A comment is required when sending a goal back.");
  await run("UPDATE goals SET status = 'sent_back', manager_comment = $1 WHERE id = $2", comment, goal.id);
  await sendEmail(emp.email, `Goal sent back: ${goal.title}`,
    `Your manager sent back "${goal.title}" with this comment:\n${comment}`, "/goals");
  back(page, `Sent back "${goal.title}".`, "ok");
}

/* ---------- Self-appraisal (employee) ---------- */

export async function submitSelfAppraisal(fd: FormData) {
  const me = await requireMe();
  const cycle = await getOpenCycle();
  if (!cycle) back("/review", "There is no open review cycle.");
  const goals = await goalsFor(me.id, cycle.id);
  if (goals.length === 0 || goals.some((g) => g.status !== "approved"))
    back("/review", "All your goals must be approved first.");
  const existing = await reviewFor(me.id, cycle.id);
  if (existing && existing.status !== "not_started") back("/review", "Your self-appraisal is already submitted.");

  const items = goals.map((g) => ({
    goal: g,
    comment: str(fd, `comment_${g.id}`),
    rating: num(fd, `rating_${g.id}`),
  }));
  for (const it of items) {
    if (!it.comment) back("/review", `Write an achievement comment for "${it.goal.title}".`);
    if (!isRating(it.rating)) back("/review", `Pick a rating for "${it.goal.title}".`);
  }
  const overall = num(fd, "overall");
  if (!isRating(overall)) back("/review", "Pick an overall self-rating.");

  await transaction(async (tx) => {
    const { rows } = await tx.query<{ id: number }>(
      `INSERT INTO reviews (employee_id, manager_id, cycle_id, status, overall_self_rating, submitted_at)
       VALUES ($1, $2, $3, 'self_submitted', $4, $5)
       ON CONFLICT (employee_id, cycle_id) DO UPDATE SET status = 'self_submitted',
         manager_id = excluded.manager_id, overall_self_rating = excluded.overall_self_rating,
         submitted_at = excluded.submitted_at
       RETURNING id`,
      [me.id, me.manager_id, cycle.id, overall, now()]);
    for (const it of items) {
      await tx.query(
        `INSERT INTO goal_ratings (review_id, goal_id, self_comment, self_rating) VALUES ($1, $2, $3, $4)
         ON CONFLICT (review_id, goal_id) DO UPDATE SET self_comment = excluded.self_comment,
           self_rating = excluded.self_rating`,
        [rows[0].id, it.goal.id, it.comment, it.rating]);
    }
  });

  // The appraisal is saved above. The email is extra: if it fails, nothing is lost.
  const manager = me.manager_id ? await getEmployee(me.manager_id) : undefined;
  if (manager) {
    await sendEmail(manager.email, `Self-appraisal submitted: ${me.full_name}`,
      `${me.full_name} has submitted their self-appraisal for ${cycle.name}. Please write your review.`, `/team/${me.id}`);
  }
  back("/review", "Self-appraisal submitted. Your manager has been notified.", "ok");
}

/* ---------- Manager review ---------- */

export async function saveManagerReview(fd: FormData) {
  const { me, emp } = await requireMyReport(num(fd, "employee_id"));
  const page = `/team/${emp.id}`;
  const cycle = await getOpenCycle();
  if (!cycle) back(page, "There is no open review cycle.");
  const review = await reviewFor(emp.id, cycle.id);
  if (!review || (review.status !== "self_submitted" && review.status !== "manager_reviewed"))
    back(page, "This review is not waiting for a manager review.");

  const goals = (await goalsFor(emp.id, cycle.id)).filter((g) => g.status === "approved");
  const items = goals.map((g) => ({ goal: g, comment: str(fd, `comment_${g.id}`), rating: num(fd, `rating_${g.id}`) }));
  for (const it of items) {
    if (!it.comment) back(page, `Write your comment for "${it.goal.title}".`);
    if (!isRating(it.rating)) back(page, `Pick your rating for "${it.goal.title}".`);
  }
  const overall = num(fd, "overall");
  const summary = str(fd, "summary");
  if (!isRating(overall)) back(page, "Pick an overall rating.");
  if (!summary) back(page, "A summary is required.");

  await transaction(async (tx) => {
    for (const it of items) {
      await tx.query("UPDATE goal_ratings SET manager_comment = $1, manager_rating = $2 WHERE review_id = $3 AND goal_id = $4",
        [it.comment, it.rating, review.id, it.goal.id]);
    }
    await tx.query(`UPDATE reviews SET status = 'manager_reviewed', manager_id = $1, overall_manager_rating = $2,
                    manager_summary = $3, reviewed_at = $4 WHERE id = $5`, [me.id, overall, summary, now(), review.id]);
  });
  back(page, "Review saved. Check it, then click Complete review.", "ok");
}

export async function completeReview(fd: FormData) {
  const { emp } = await requireMyReport(num(fd, "employee_id"));
  const page = `/team/${emp.id}`;
  const cycle = await getOpenCycle();
  if (!cycle) back(page, "There is no open review cycle.");
  const review = await reviewFor(emp.id, cycle.id);
  if (!review || review.status !== "manager_reviewed") back(page, "Save the manager review before completing it.");
  await run("UPDATE reviews SET status = 'completed' WHERE id = $1", review.id);
  await sendEmail(emp.email, `Your ${cycle.name} review is complete`,
    `Your manager has completed your review for ${cycle.name}.`, "/review");
  back(page, `${emp.full_name}'s review is Completed.`, "ok");
}
