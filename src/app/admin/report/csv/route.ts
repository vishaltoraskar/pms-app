// GET /admin/report/csv?cycle=1 -> downloads the completion report as a CSV file. HR only.
import { getMe } from "@/lib/auth";
import { getCycle } from "@/lib/queries";
import { reportRows } from "../data";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const me = await getMe();
  if (!me || me.role !== "hr_admin") return new Response("Not allowed", { status: 403 });
  const cycle = await getCycle(Number(new URL(req.url).searchParams.get("cycle")));
  if (!cycle) return new Response("Cycle not found", { status: 404 });

  const header = ["Name", "Department", "Manager", "Goals", "Approved goals", "Status", "Overall self rating", "Overall manager rating"];
  const lines = (await reportRows(cycle.id)).map((r) =>
    [r.full_name, r.department, r.manager, r.goals, r.approved_goals, r.status, r.overall_self_rating, r.overall_manager_rating]
      .map(cell).join(","));
  return new Response([header.map(cell).join(","), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="completion-${cycle.name.replace(/\W+/g, "-")}.csv"`,
    },
  });
}
