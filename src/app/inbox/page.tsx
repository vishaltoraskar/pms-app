import { requireMe } from "@/lib/auth";
import { all } from "@/lib/db";
import type { Email } from "@/lib/types";
import { Empty } from "@/components/ui";

// Shows the emails the app has sent to you. Handy for demos without a real email account.
export default async function Inbox() {
  const me = await requireMe();
  const emails = await all<Email>("SELECT * FROM emails WHERE to_email = $1 ORDER BY id DESC", me.email);
  return (
    <div className="space-y-4">
      <h1 className="h1">Inbox</h1>
      <p className="text-sm text-slate-600">Emails sent to {me.email}.</p>
      {emails.length === 0 ? (
        <Empty>No emails yet. You&apos;ll get one when, for example, a team member submits a self-appraisal.</Empty>
      ) : (
        emails.map((e) => (
          <div key={e.id} className="card">
            <div className="flex flex-wrap justify-between gap-2">
              <b>{e.subject}</b>
              <span className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString("en-IN")} · {e.sent_via}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{e.body}</p>
          </div>
        ))
      )}
    </div>
  );
}
