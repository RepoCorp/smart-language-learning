import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useI18n, type AppLanguage } from "../../../i18n";
import ItemPreview from "./ItemPreview";
import { locales } from "../locales";
import { useDefinitionCatalog } from "./useDefinitionCatalog";
import "./LearningContentPlayground.css";

export default function LearningContentPlayground(): ReactElement {
  const { language } = useI18n();
  const text = locales[language];
  const [interfaceLanguage, setInterfaceLanguage] = useState<AppLanguage>(language);
  const [sourceLanguage, setSourceLanguage] = useState("spanish");
  const [selectedKey, setSelectedKey] = useState("");
  const [narrow, setNarrow] = useState(false);
  const { definitions, status, error, reload } = useDefinitionCatalog();
  const selected = definitions.find(definition => definition.key === selectedKey) ?? definitions[0];

  return <main className="container learning-content-playground">
    <header className="card">
      <Link to="/admin">{text.backToAdmin}</Link>
      <h1>{text.playgroundTitle}</h1>
      <p>{text.playgroundNote}</p>
    </header>
    <section className="card learning-content-playground__controls">
      <label>{text.definition}
        <select value={selected?.key ?? ""} onChange={event => setSelectedKey(event.target.value)} disabled={status !== "ready" || !definitions.length}>
          {definitions.map(definition => <option key={definition.key} value={definition.key}>
            {definition.display[interfaceLanguage]?.title ?? definition.key}
          </option>)}
        </select>
      </label>
      <label>{text.interfaceLanguage}
        <select value={interfaceLanguage} onChange={event => setInterfaceLanguage(event.target.value as AppLanguage)}>
          <option value="en">{text.english}</option><option value="es">{text.spanish}</option>
        </select>
      </label>
      <label>{text.sourceLanguage}
        <select value={sourceLanguage} onChange={event => setSourceLanguage(event.target.value)}>
          <option value="english">{text.english}</option><option value="spanish">{text.spanish}</option>
        </select>
      </label>
      <label className="learning-content-playground__narrow">
        <input type="checkbox" checked={narrow} onChange={event => setNarrow(event.target.checked)} />{text.narrowPreview}
      </label>
      <button type="button" disabled={status === "loading"} onClick={reload}>{text.reload}</button>
    </section>
    {status === "loading" && <p role="status">{text.loading}</p>}
    {status === "error" && error && <p role="alert">
      {text.catalogErrors[error.kind]}{error.status ? ` (HTTP ${error.status})` : ""}
    </p>}
    {status === "ready" && !selected && <p role="status">{text.empty}</p>}
    {status === "ready" && selected && <>
      <ItemPreview key={selected.key} definition={selected} sourceLanguage={sourceLanguage} interfaceLanguage={interfaceLanguage} narrow={narrow} />
      <p>{text.activitiesNote}</p>
      <details className="card learning-content-playground__data">
        <summary>{text.rawData}</summary>
        <pre>{JSON.stringify(selected, null, 2)}</pre>
      </details>
    </>}
  </main>;
}
