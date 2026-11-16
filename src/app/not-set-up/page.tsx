import { SignOutButton } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";

// Shown when someone signs in with Clerk but their email is not in the employees table.
export default function NotSetUp() {
  return (
    <div className="card mx-auto max-w-md text-center">
      <h1 className="h2">Your account is not yet set up</h1>
      <p className="text-slate-600">Please contact HR. They need to add you as an employee using the same email you signed in with.</p>
      {clerkEnabled && (
        <SignOutButton redirectUrl="/"><button className="btn mt-4">Sign out</button></SignOutButton>
      )}
    </div>
  );
}
