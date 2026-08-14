import { useI18n } from "../../i18n";

export default function GrammarMethodologyFooter(): JSX.Element {
  const { t } = useI18n();
  return (
    <footer className="grammar-strategy-methodology">
      <p>{t("strategies.grammar.description")}</p>
      <p>{t("strategies.grammar.footnote")}</p>
    </footer>
  );
}
