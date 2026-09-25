import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";
import { AdminShell } from "@/components/admin";
import { QuestionVersionEditor } from "@/components/admin/QuestionVersionEditor.client";
import { getSuperadminNewQuestionPageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

async function authorizeNewQuestion() {
  try { return await getSuperadminNewQuestionPageModel(); }
  catch (error) { if (error instanceof AuthenticationRequiredError) redirect("/"); if (error instanceof SuperadminAccessDeniedError) notFound(); throw error; }
}

export default async function NewQuestionPage() {
  const page = await authorizeNewQuestion();
  return (
    <AdminShell
      operator={page.operator}
      activeSection="questions"
      breadcrumbs={[{ label: "Resumen", href: "/admin" }, { label: "Preguntas", href: "/admin/questions" }, { label: "Nueva pregunta" }]}
    >
      <QuestionVersionEditor newQuestion />
    </AdminShell>
  );
}
