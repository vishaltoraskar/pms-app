# ReviewDesk: a simple Performance Management System

HR runs a review cycle, employees set goals and write a self-appraisal, and managers approve goals and give the final rating.

**Stack:** Next.js (App Router, TypeScript, Tailwind) · Supabase (Postgres) · Clerk · Resend · Vercel

## Run it on your computer

```bash
npm install
npm run dev
```

Open http://localhost:3001 and click **Sign in**.

With no keys at all, the app runs in demo mode: a small Postgres (PGlite) stored in `~/.pms-app`, and a pick-a-person sign-in. Add keys to `.env.local` (copy `.env.example`) to switch each part to the real service:

| Variable | Turns on |
|---|---|
| `DATABASE_URL` | Supabase database (tables and demo data are created automatically on first run) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk sign-in / sign-up |
| `RESEND_API_KEY` | Real emails (they also always appear on the Inbox page) |
| `APP_URL` | Correct links inside emails |

Restart `npm run dev` after editing `.env.local`.

## How sign-in links to an employee

Clerk only proves who you are. On first sign-in the app takes your verified Clerk email, finds the employee with that email, and saves `clerk_user_id` on that row. If no employee has that email you see "Your account is not yet set up. Please contact HR." Your role always comes from the database.

For testing three roles without three inboxes, use Clerk test emails: sign in as `priya.nair+clerk_test@example.com` (HR), `rahul.mehta+clerk_test@example.com` (Manager) or `anita.desai+clerk_test@example.com` (Employee), and enter the code **424242**. This works in a Clerk development instance.

## Supabase security (Row Level Security)

RLS is turned on for every table with no policies. That means Supabase's public API (the anon key) can read nothing. Only our server, which connects with the database password in `DATABASE_URL`, can read or write. Every page and action checks the user's role before it runs a query.

## Demo users

| Person | Role |
|---|---|
| Priya Nair | HR Admin |
| Rahul Mehta | Manager (Anita, Karan report to him) |
| Anita Desai, Karan Shah | Employees under Rahul |
| Meera Pillai | Employee under Priya |

## The workflow

- **Cycle:** Draft → Open → Closed. Only one cycle can be open at a time.
- **Goal:** Draft → Submitted → Approved. The manager can also send a goal back, with a comment, and the employee edits and resubmits it. Weightages must total exactly 100 before submitting.
- **Review:** Not started → Self-appraisal submitted → Manager reviewed → Completed.

## Where things are

| Path | What it does |
|---|---|
| `src/lib/schema.ts` | The SQL for the tables, RLS, and demo data |
| `src/lib/db.ts` | Connects to Supabase (or local PGlite) and sets up the tables on first run |
| `src/lib/auth.ts` | Who is signed in (Clerk or demo), linking to the employee row, and the HR-only check |
| `src/proxy.ts` | Lets Clerk see each request |
| `src/lib/queries.ts` | Shared read helpers (open cycle, goals, review status) |
| `src/lib/email.ts` | Sends email (saved to the Inbox page; also sent by Resend if `RESEND_API_KEY` is set) |
| `src/app/actions.ts` | Every form action: role check, validation, then the database write |
| `src/app/...` | One folder per page: dashboard, goals, review, team, admin, inbox |

## Security rules followed

- Every page and every action checks the user's role on the server. Hiding a menu item is not counted as a check.
- An employee only ever sees their own review: `/review` always filters by the signed-in user. `/team/[id]` only opens for that person's manager (or HR, read-only).
- Manager is not a stored role. Anyone with direct reports is a manager (`employees.manager_id` points back to the same table).
- No secrets are in the repo. `.env.local` is git-ignored.

## Real email

Set `RESEND_API_KEY`. On a free Resend account, emails only reach the address you signed up to Resend with, so (as HR, under Employees) set the manager's email to your own before testing.

## Deploy to Vercel

Import the GitHub repo in Vercel, add the same variables from `.env.local` under Settings → Environment Variables, and redeploy. Add the Vercel URL to Clerk's allowed domains if Clerk asks.
