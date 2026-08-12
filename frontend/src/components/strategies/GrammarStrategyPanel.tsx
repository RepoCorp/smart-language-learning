import { useI18n } from "../../i18n";

export default function GrammarStrategyPanel(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="word-strategies-placeholder-card grammar-strategy-panel">
      <p className="word-strategies-placeholder-title">
        <strong>{t("strategies.grammar.title")}</strong>
      </p>
      <p>{t("strategies.grammar.description")}</p>
      <p className="hint grammar-strategy-footnote">{t("strategies.grammar.footnote")}</p>
    </div>
  );
}
