import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";

// Clerk sign-up. Your email must match an employee HR has added, or you'll see "not yet set up".
export default function SignUpPage() {
  if (!clerkEnabled) redirect("/sign-in");
  return (
    <div className="flex justify-center py-6">
      <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </div>
  );
}
