import { notFound, redirect } from "next/navigation";
import { AuthenticationRequiredError, SuperadminAccessDeniedError } from "@/application/administration/errors";

export async function loadAdminPageModel<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/");
    if (error instanceof SuperadminAccessDeniedError) notFound();
    throw error;
  }
}
