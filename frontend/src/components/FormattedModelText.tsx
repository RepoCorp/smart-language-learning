import { Fragment } from "react";

type Props = {
  text: string;
  className?: string;
};

function renderInlineMarkup(text: string): JSX.Element[] {
  return text
    .split(/(\*\*.*?\*\*|\*.*?\*|<<.*?>>|«.*?»)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={`strong-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <Fragment key={`em-${index}`}>{part.slice(1, -1)}</Fragment>;
      }
      if (part.startsWith("<<") && part.endsWith(">>") && part.length > 4) {
        return <strong key={`angle-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("«") && part.endsWith("»") && part.length > 2) {
        return <strong key={`guillemet-${index}`}>{part.slice(1, -1)}</strong>;
      }
      return <Fragment key={`text-${index}`}>{part}</Fragment>;
    });
}

export default function FormattedModelText({ text, className }: Props): JSX.Element {
  const blocks = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((paragraph, paragraphIndex) => {
        const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.every((line) => line.startsWith("- ") || line.startsWith("* "));

        if (isList) {
          return (
            <ul key={`list-${paragraphIndex}`} className="formatted-model-text-list">
              {lines.map((line, lineIndex) => (
                <li key={`item-${paragraphIndex}-${lineIndex}`}>
                  {renderInlineMarkup(line.replace(/^[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${paragraphIndex}`} className="formatted-model-text-paragraph">
            {lines.map((line, lineIndex) => (
              <Fragment key={`line-${paragraphIndex}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInlineMarkup(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
