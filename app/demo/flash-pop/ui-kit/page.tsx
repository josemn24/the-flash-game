import { notFound, redirect } from "next/navigation";
import { isDesignSystemAvailable } from "@/features/design-system/access";

export default function LegacyUiKitPage() {
  if (!isDesignSystemAvailable(process.env.NODE_ENV)) notFound();
  redirect("/design-system");
}
