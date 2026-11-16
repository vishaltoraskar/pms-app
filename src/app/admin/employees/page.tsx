import Link from "next/link";
import { requireHr } from "@/lib/auth";
import { all } from "@/lib/db";
import type { Employee } from "@/lib/types";
import { Empty, Flash, one, type SearchParams } from "@/components/ui";
import { saveEmployee } from "../../actions";

export default async function Employees({ searchParams }: { searchParams: SearchParams }) {
  await requireHr();
  const people = await all<Employee>("SELECT * FROM employees ORDER BY is_active DESC, full_name");
  const byId = new Map(people.map((p) => [p.id, p]));
  const editId = Number(one((await searchParams).edit));
  const editing = byId.get(editId);

  return (
    <div className="space-y-6">
      <h1 className="h1">Employees</h1>
      <Flash searchParams={searchParams} />

      <section className="card overflow-x-auto">
        {people.length === 0 ? (
          <Empty>No employees yet. Add the first one below.</Empty>
        ) : (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>Manager</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className={p.is_active ? "" : "text-slate-400"}>
                  <td><div className="font-medium">{p.full_name}</div><div className="text-xs text-slate-500">{p.email}</div></td>
                  <td>{p.designation}</td>
                  <td>{p.department}</td>
                  <td>{p.manager_id ? byId.get(p.manager_id)?.full_name : "-"}</td>
                  <td>{p.role === "hr_admin" ? "HR Admin" : people.some((x) => x.manager_id === p.id && x.is_active) ? "Manager" : "Employee"}</td>
                  <td>{p.is_active ? "Active" : "Inactive"}</td>
                  <td className="text-right"><Link href={`/admin/employees?edit=${p.id}`} className="btn">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="h2">{editing ? `Edit ${editing.full_name}` : "Add an employee"}</h2>
        <form action={saveEmployee} className="grid gap-4 sm:grid-cols-2" key={editing?.id ?? "new"}>
          <input type="hidden" name="id" value={editing?.id ?? ""} />
          <Field label="Full name" name="full_name" value={editing?.full_name} />
          <Field label="Email" name="email" type="email" value={editing?.email} />
          <Field label="Designation" name="designation" value={editing?.designation} />
          <Field label="Department" name="department" value={editing?.department} />
          <Field label="Date of joining" name="date_of_joining" type="date" value={editing?.date_of_joining} />
          <div>
            <label className="label">Manager</label>
            <select name="manager_id" defaultValue={editing?.manager_id ?? ""} className="input">
              <option value="">No manager</option>
              {people.filter((p) => p.is_active && p.id !== editing?.id).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.designation})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" defaultValue={editing?.role ?? "employee"} className="input">
              <option value="employee">Employee (becomes Manager automatically when someone reports to them)</option>
              <option value="hr_admin">HR Admin</option>
            </select>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={!!editing.is_active} /> Active
            </label>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn btn-primary">{editing ? "Save changes" : "Add employee"}</button>
            {editing && <Link href="/admin/employees" className="btn">Cancel</Link>}
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, name, value, type = "text" }: { label: string; name: string; value?: string; type?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} required defaultValue={value} className="input" />
    </div>
  );
}
