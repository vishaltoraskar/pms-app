// Who is signed in, and what are they allowed to do. Runs on the server only.
// - Clerk keys set (Vercel): sign in with Clerk. The Clerk user is linked to an employee row by email.
// - No Clerk keys (localhost demo): pick an employee from a list; their id is kept in a cookie.
// The role always comes from our database, never from Clerk.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "./db";
import type { Employee } from "./types";

export const COOKIE = "pms_user";
export const clerkEnabled = !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Which employee is this visitor? "none" = not signed in; "unknown" = signed in to Clerk, but HR hasn't added them.
async function employeeId(): Promise<number | "none" | "unknown"> {
  if (!clerkEnabled) {
    const id = Number((await cookies()).get(COOKIE)?.value);
    return id || "none";
  }
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return "none";
  const linked = await get<{ id: number }>("SELECT id FROM employees WHERE clerk_user_id = $1", userId);
  if (linked) return linked.id;

  // First sign-in: match the verified Clerk email to an employee's email, then save the link.
  // "name+clerk_test@example.com" is Clerk's test-email format (code 424242) and maps to "name@example.com".
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase().replace("+clerk_test@", "@"));
  for (const email of emails) {
    const emp = await get<{ id: number }>("SELECT id FROM employees WHERE lower(email) = $1 AND clerk_user_id IS NULL", email);
    if (emp) {
      await run("UPDATE employees SET clerk_user_id = $1 WHERE id = $2", userId, emp.id);
      return emp.id;
    }
  }
  return "unknown";
}

const loadActive = (id: number) => get<Employee>("SELECT * FROM employees WHERE id = $1 AND is_active = 1", id);

export async function getMe() {
  const id = await employeeId();
  return typeof id === "number" ? ((await loadActive(id)) ?? null) : null;
}

export async function requireMe() {
  const id = await employeeId();
  if (id === "none") redirect("/sign-in");
  if (id === "unknown") redirect("/not-set-up");
  const me = await loadActive(id);
  if (!me) redirect(clerkEnabled ? "/not-set-up" : "/sign-in");
  return me;
}

export async function requireHr() {
  const me = await requireMe();
  if (me.role !== "hr_admin") redirect("/dashboard?error=" + encodeURIComponent("Only HR Admin can open that page."));
  return me;
}
