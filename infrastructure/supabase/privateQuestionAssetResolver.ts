import type { PrivateQuestionAssetResolver } from "@/application/ports/private-question-assets";
import { resolveCompetitiveQuestionPayload } from "@/infrastructure/supabase/questionAssetRuntime";

export const supabasePrivateQuestionAssetResolver: PrivateQuestionAssetResolver = {
  resolve: resolveCompetitiveQuestionPayload,
};
