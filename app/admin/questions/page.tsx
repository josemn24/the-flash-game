import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";
import { QuestionLibraryManagement } from "@/components/admin/QuestionLibraryManagement.client";
import { getSuperadminPortalPageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

async function loadQuestionsPage() {
  try {
    return await getSuperadminPortalPageModel();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/");
    if (error instanceof SuperadminAccessDeniedError) notFound();
    throw error;
  }
}

export default async function QuestionsPage() {
  const context = await loadQuestionsPage();
  return <QuestionLibraryManagement library={context.questionLibrary ?? { entries: [], total: 0, page: 1, pageSize: 25, source: "supabase" }} />;
}
