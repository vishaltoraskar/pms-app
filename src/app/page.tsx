import Link from "next/link";
import { getMe } from "@/lib/auth";

const FEATURES = [
  ["Goals that add up", "Set goals against the open cycle, weighted to 100, and get them approved by your manager."],
  ["Self + manager review", "Rate yourself goal by goal. Your manager sees it side by side and gives the final rating."],
  ["One place for HR", "Open and close cycles, manage the reporting line, and see who has finished."],
];

export default async function Home() {
  const me = await getMe();
  return (
    <div className="py-10 text-center">
      <h1 className="text-4xl font-bold text-slate-900">ReviewDesk</h1>
      <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
        A simple performance management system: goals, self-appraisal and manager review in one place,
        instead of email and Excel.
      </p>
      <Link href={me ? "/dashboard" : "/sign-in"} className="btn btn-primary mt-6 px-6 py-2 text-base">
        {me ? "Go to dashboard" : "Sign in"}
      </Link>
      <div className="mt-12 grid gap-4 text-left sm:grid-cols-3">
        {FEATURES.map(([title, text]) => (
          <div key={title} className="card">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
