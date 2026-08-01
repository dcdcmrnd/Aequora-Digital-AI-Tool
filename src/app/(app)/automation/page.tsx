import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Zap } from "lucide-react";

import { authOptions } from "@/lib/auth";

export default async function AutomationPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-card border-border max-w-md border bg-white p-8 text-center">
        <div className="bg-brand-primary/10 text-brand-primary mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
          <Zap className="size-6" />
        </div>
        <h1 className="text-text-primary text-lg font-semibold">Automation</h1>
        <p className="text-text-muted mt-2 text-sm">
          Coming soon. This is where you&apos;ll be able to automate outreach to your saved Leads and Contacts.
        </p>
      </div>
    </div>
  );
}
