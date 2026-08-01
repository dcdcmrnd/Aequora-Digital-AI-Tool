import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { ContactsListView } from "@/components/contacts/ContactsListView";
import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

export default async function ContactsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const canView = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.view"));
  if (!canView) redirect("/");

  return <ContactsListView />;
}
