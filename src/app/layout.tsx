import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ClerkProvider, SignOutButton } from "@clerk/nextjs";
import "./globals.css";
import { clerkEnabled, getMe } from "@/lib/auth";
import { isManager } from "@/lib/queries";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "ReviewDesk PMS", description: "Performance Management System" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  // Navigation changes by role. (Each page also checks the role on the server.)
  const links: [string, string][] = [];
  if (me) {
    links.push(["/dashboard", "Dashboard"], ["/goals", "My Goals"], ["/review", "My Review"]);
    if (await isManager(me.id)) links.push(["/team", "My Team"]);
    if (me.role === "hr_admin")
      links.push(["/admin/employees", "Employees"], ["/admin/cycles", "Cycles"], ["/admin/report", "Report"]);
    links.push(["/inbox", "Inbox"]);
  }
  const signOutButton = <button className="btn">Sign out</button>;

  const page = (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link href={me ? "/dashboard" : "/"} className="font-bold text-indigo-700">ReviewDesk</Link>
            <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {links.map(([href, label]) => (
                <Link key={href} href={href} className="text-slate-600 hover:text-indigo-700">{label}</Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2 text-sm">
              {me && (
                <span className="text-slate-600">
                  {me.full_name}
                  {me.role === "hr_admin" && <span className="ml-1 text-xs text-indigo-600">(HR Admin)</span>}
                </span>
              )}
              {me ? (
                clerkEnabled ? <SignOutButton redirectUrl="/">{signOutButton}</SignOutButton> : <form action={signOut}>{signOutButton}</form>
              ) : (
                <Link href="/sign-in" className="btn btn-primary">Sign in</Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
