import type { ReactNode } from "react";

import { useI18n } from "../../i18n";

export type StaticGrammarRow = {
  topic: ReactNode;
  example: ReactNode;
  note: ReactNode;
};

export default function StaticGrammarTable({ rows }: { rows: StaticGrammarRow[] }): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="grammar-strategy-panel">
      <p className="grammar-strategy-intro">{t("strategies.grammar.description")}</p>
      <div className="grammar-strategy-table-wrap">
        <table className="grammar-strategy-table">
          <thead>
            <tr>
              <th>{t("strategies.grammar.topic")}</th>
              <th>{t("strategies.grammar.example")}</th>
              <th>{t("strategies.grammar.note")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <th>{row.topic}</th>
                <td>{row.example}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint grammar-strategy-footnote">{t("strategies.grammar.footnote")}</p>
    </div>
  );
}
