import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CallsListView } from "@/components/calls/CallsListView";
import { authOptions } from "@/lib/auth";

export const metadata = { title: "Calls — Aequora Digital" };

export default async function CallsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <CallsListView />;
}
