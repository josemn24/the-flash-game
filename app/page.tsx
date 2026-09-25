import { AuthPanel } from "@/components/auth/AuthPanel.client";
import { FlashPopHome } from "@/components/game";
import { getHomePageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const model = await getHomePageModel();
  if (!model) return <AuthPanel />;

  return <FlashPopHome rooms={model.rooms} initialProfile={model.currentViewer} />;
}
