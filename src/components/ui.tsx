// Small shared UI pieces used on many pages.
import Link from "next/link";
import { RATINGS } from "@/lib/types";

const LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  sent_back: "Sent back",
  open: "Open",
  closed: "Closed",
  not_started: "Not started",
  self_submitted: "Self-appraisal submitted",
  manager_reviewed: "Manager reviewed",
  completed: "Completed",
};

const COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  sent_back: "bg-amber-100 text-amber-800",
  open: "bg-green-100 text-green-800",
  closed: "bg-slate-200 text-slate-700",
  not_started: "bg-slate-100 text-slate-700",
  self_submitted: "bg-blue-100 text-blue-800",
  manager_reviewed: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
};

export function Status({ value }: { value: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[value] ?? ""}`}>
      {LABELS[value] ?? value}
    </span>
  );
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Green / red message shown after a form is submitted.
export async function Flash({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const error = one(sp.error);
  const ok = one(sp.ok);
  if (error) return <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  if (ok) return <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>;
  return null;
}

export function Empty({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="card text-center text-slate-600">
      <p>{children}</p>
      {href && <Link href={href} className="btn btn-primary mt-3">{cta}</Link>}
    </div>
  );
}

export function RatingSelect({ name, defaultValue }: { name: string; defaultValue?: number | null }) {
  return (
    <select name={name} required defaultValue={defaultValue ?? ""} className="input">
      <option value="" disabled>Choose a rating</option>
      {Object.entries(RATINGS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

export const ratingText = (n: number | null | undefined) => (n ? RATINGS[n] : "-");
