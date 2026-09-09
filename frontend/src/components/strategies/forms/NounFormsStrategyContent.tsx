import { nounFormsContentForGenerationMode } from "./nounFormsStrategyRegistry";
import type { NounFormsStrategyContentProps } from "./nounFormsTypes";

type Props = NounFormsStrategyContentProps & { generationMode: string };

export default function NounFormsStrategyContent({ generationMode, ...props }: Props): JSX.Element | null {
  const Content = nounFormsContentForGenerationMode(generationMode);
  return Content ? <Content {...props} /> : null;
}
