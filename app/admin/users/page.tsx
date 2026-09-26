import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import { AdminShell } from "@/components/admin/AdminShell";
import { SuperadminUserCreation } from "@/components/admin/SuperadminUserCreation.client";
import { getSuperadminOperatorPageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Usuarios · Portal de operaciones" };

async function loadPage() {
  try {
    return await getSuperadminOperatorPageModel();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/");
    if (error instanceof SuperadminAccessDeniedError) notFound();
    throw error;
  }
}

export default async function AdminUsersPage() {
  const operator = await loadPage();
  return (
    <AdminShell
      operator={operator}
      activeSection="users"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Usuarios" }]}
    >
      <SuperadminUserCreation />
    </AdminShell>
  );
}
