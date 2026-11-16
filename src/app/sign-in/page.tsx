import { SignIn } from "@clerk/nextjs";
import { all } from "@/lib/db";
import { clerkEnabled } from "@/lib/auth";
import type { Employee } from "@/lib/types";
import { Flash, type SearchParams } from "@/components/ui";
import { signIn } from "../actions";

type Person = Employee & { is_manager: boolean };

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const people = await all<Person>(
    `SELECT e.*, EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.id AND r.is_active = 1) AS is_manager
     FROM employees e WHERE e.is_active = 1 ORDER BY e.role DESC, e.full_name`);
  const roleOf = (p: Person) => (p.role === "hr_admin" ? "HR Admin" : p.is_manager ? "Manager" : "Employee");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="h1">Sign in</h1>
      <Flash searchParams={searchParams} />

      {clerkEnabled ? (
        <>
          <div className="flex justify-center">
            <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
          </div>
          {/* Clerk test emails: any address with "+clerk_test" gets the code 424242, no real inbox needed. */}
          <div className="card text-sm">
            <p className="mb-2 font-medium">Test logins: use the email below, then the code 424242</p>
            {people.map((p) => (
              <p key={p.id} className="flex justify-between gap-2 py-0.5">
                <span className="font-mono text-xs">{p.email.replace("@", "+clerk_test@")}</span>
                <span className="text-xs text-indigo-700">{roleOf(p)}</span>
              </p>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">Demo mode (no Clerk keys set): choose a person to sign in as.</p>
          <div className="card space-y-2">
            {people.map((p) => (
              <form key={p.id} action={signIn}>
                <input type="hidden" name="id" value={p.id} />
                <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-indigo-400 hover:bg-indigo-50">
                  <span>
                    <span className="font-medium">{p.full_name}</span>
                    <span className="block text-xs text-slate-500">{p.designation}</span>
                  </span>
                  <span className="text-xs font-medium text-indigo-700">{roleOf(p)}</span>
                </button>
              </form>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
