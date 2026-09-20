import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";
import { AdminShell } from "@/components/admin";
import { QuestionLibraryManagement } from "@/components/admin/QuestionLibraryManagement.client";
import { getSuperadminQuestionLibraryPageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

async function loadQuestionsPage() {
  try {
    return await getSuperadminQuestionLibraryPageModel();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/");
    if (error instanceof SuperadminAccessDeniedError) notFound();
    throw error;
  }
}

export default async function QuestionsPage() {
  const page = await loadQuestionsPage();
  return (
    <AdminShell
      operator={page.operator}
      activeSection="questions"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Preguntas" }]}
    >
      <QuestionLibraryManagement
        library={page.library ?? { entries: [], total: 0, page: 1, pageSize: 25, source: "supabase" }}
      />
    </AdminShell>
  );
}
