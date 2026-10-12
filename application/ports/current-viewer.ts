import type { ViewerProfile } from "@/types/view-models";

export interface CurrentViewerReader {
  getCurrentViewer(): Promise<ViewerProfile | null>;
}
