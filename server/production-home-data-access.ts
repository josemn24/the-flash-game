import "server-only";

import { cache } from "react";
import { productionReadServices } from "@/server/composition/production";

export const getHomePageModel = cache(async () => {
  return productionReadServices.rooms.getHome();
});
