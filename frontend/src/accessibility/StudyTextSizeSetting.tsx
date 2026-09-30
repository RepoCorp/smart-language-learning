import { useId } from "react";
import { useI18n } from "../i18n";
import { STUDY_TEXT_SIZES, useStudyTextSize } from "./StudyTextSizeProvider";

const messages = {
  en: { title: "Tappable text size", options: ["Normal", "Large", "Extra large", "Largest"], preview: "Words you can tap" },
  es: { title: "Tamaño del texto que puedes tocar", options: ["Normal", "Grande", "Muy grande", "Máximo"], preview: "Palabras que puedes tocar" },
};

export default function StudyTextSizeSetting(): JSX.Element {
  const { language } = useI18n();
  const { size, setSize } = useStudyTextSize();
  const id = useId();
  const copy = messages[language];
  return <div className="settings-field" data-guide-target="study-text-size">
    <label htmlFor={id}>{copy.title}</label>
    <select id={id} value={size} onChange={event => {
      const selected = STUDY_TEXT_SIZES.find(value => String(value) === event.target.value);
      if (selected) setSize(selected);
    }}>
      {STUDY_TEXT_SIZES.map((value, index) => <option key={value} value={value}>{copy.options[index]}</option>)}
    </select>
    <p className="target-phrase-text-dialog study-text-size-preview">{copy.preview}</p>
  </div>;
}
