import {
  ButtonsExample,
  ChipsExample,
  AvatarsExample,
  SurfacesExample,
  NavigationExample,
  TimersExample,
  IconsExample,
} from "./ComponentExamples.client";
import {
  FormsExample,
  FeedbackExample,
  RankingsExample,
  ReviewExample,
  LoadingExample,
} from "./PatternExamples.client";

const renderers = {
  botones: ButtonsExample,
  chips: ChipsExample,
  avatares: AvatarsExample,
  superficies: SurfacesExample,
  navegacion: NavigationExample,
  temporizadores: TimersExample,
  iconos: IconsExample,
  formularios: FormsExample,
  feedback: FeedbackExample,
  rankings: RankingsExample,
  revision: ReviewExample,
  "carga-vacio": LoadingExample,
};
export const catalogExampleIds = Object.keys(renderers);
export function CatalogExample({ id }: { id: string }) {
  const Example = renderers[id as keyof typeof renderers];
  return Example ? <Example /> : null;
}
