import { FlashPopHome } from "@/components/game";
import { getHomePageModel } from "@/server/data-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const model = await getHomePageModel();
  return <FlashPopHome rooms={model.rooms} initialProfile={model.currentViewer} />;
}
