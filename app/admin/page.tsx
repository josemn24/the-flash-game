import { redirect, notFound } from "next/navigation";
import { AdminPortal } from "@/components/admin";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import { getSuperadminPortalPageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

async function loadAdminContext() {
  try {
    return await getSuperadminPortalPageModel();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/");
    if (error instanceof SuperadminAccessDeniedError) notFound();
    throw error;
  }
}

export default async function AdminPage() {
  const context = await loadAdminContext();
  return <AdminPortal context={context} />;
}
