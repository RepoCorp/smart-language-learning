import { Fragment, type ReactElement, type ReactNode } from "react";

export default function EvaluationQuestion({ template, values }: {
  template: string;
  values: Record<string, ReactNode>;
}): ReactElement {
  return <p>{template.split(/(\{\w+\})/).map((part, index) =>
    <Fragment key={index}>{values[part] ?? part}</Fragment>)}</p>;
}
