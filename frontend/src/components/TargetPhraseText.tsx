import type { ReactNode } from "react";

import { useI18n } from "../i18n";

type TargetPhraseVariant = "dialog" | "review" | "chat";

interface TargetPhraseTextProps {
  as?: "p" | "div" | "span";
  text?: string;
  children?: ReactNode;
  hideText?: boolean;
  className?: string;
  variant?: TargetPhraseVariant;
}

export default function TargetPhraseText({
  as: Component = "p",
  text = "",
  children,
  hideText = false,
  className = "",
  variant = "dialog",
}: TargetPhraseTextProps): JSX.Element {
  const { t } = useI18n();
  const classes = ["target-phrase-text", `target-phrase-text-${variant}`, className].filter(Boolean).join(" ");

  return (
    <Component className={classes}>
      {hideText ? <span className="prompt-audio-placeholder">{t("prompt.audioOnly")}</span> : (children ?? text)}
    </Component>
  );
}
