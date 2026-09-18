import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";
import { QuestionVersionEditor } from "@/components/admin/QuestionVersionEditor.client";
import { requireSuperadmin } from "@/server/admin";

export const dynamic = "force-dynamic";

async function authorizeNewQuestion() {
  try { await requireSuperadmin(); }
  catch (error) { if (error instanceof AuthenticationRequiredError) redirect("/"); if (error instanceof SuperadminAccessDeniedError) notFound(); throw error; }
}

export default async function NewQuestionPage() {
  await authorizeNewQuestion();
  return <QuestionVersionEditor newQuestion />;
}
