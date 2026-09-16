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

type AdminPageProps = {
  readonly searchParams: Promise<{ created?: string; season?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const context = await loadAdminContext();
  const params = await searchParams;
  return (
    <AdminPortal
      context={context}
      creationNotice={params.created === "1"}
      seasonNotice={params.season}
    />
  );
}
