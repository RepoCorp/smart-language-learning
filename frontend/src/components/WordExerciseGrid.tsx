import type { CSSProperties } from "react";

import DangerousButton from "./DangerousButton";

export interface WordExerciseSelectableEntry {
  label?: string;
  source: string;
  target: string;
}

export interface WordExerciseGridPrimaryEntry {
  entry: WordExerciseSelectableEntry;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  detailText?: string;
}

interface WordExerciseGridHeader {
  key: string;
  label: string;
  sublabel?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  secondaryActionLabel?: string;
  secondaryActionDisabled?: boolean;
  secondaryActionRequiresConfirm?: boolean;
  onSecondaryActionClick?: () => void;
}

interface WordExerciseGridCell {
  key: string;
  entry?: WordExerciseSelectableEntry;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

interface WordExerciseGridRow {
  key: string;
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  cells: WordExerciseGridCell[];
}

interface WordExerciseGridProps {
  ariaLabel: string;
  columns: WordExerciseGridHeader[];
  rows: WordExerciseGridRow[];
  primaryEntry?: WordExerciseGridPrimaryEntry;
  className?: string;
  targetClassName?: string;
  columnMinWidth?: string;
  rowHeaderWidth?: string;
}

function HeaderCell({
  label,
  sublabel,
  selected = false,
  onClick,
  disabled = false,
  secondaryActionLabel,
  secondaryActionDisabled = false,
  secondaryActionRequiresConfirm = false,
  onSecondaryActionClick,
  className,
}: {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  secondaryActionLabel?: string;
  secondaryActionDisabled?: boolean;
  secondaryActionRequiresConfirm?: boolean;
  onSecondaryActionClick?: () => void;
  className?: string;
}): JSX.Element {
  const classes = [
    "word-exercise-cell",
    "word-exercise-header",
    selected ? "word-exercise-selected" : "",
    className || "",
  ].filter(Boolean).join(" ");

  const content = (
    <span className="word-exercise-header-inner">
      <span className="word-exercise-header-copy">
        <span>{label}</span>
        {sublabel ? <small>{sublabel}</small> : null}
      </span>
    </span>
  );

  const secondaryAction = onSecondaryActionClick ? (
    secondaryActionRequiresConfirm ? (
      <DangerousButton
        className="word-exercise-header-secondary-action"
        disabled={secondaryActionDisabled}
        onConfirm={onSecondaryActionClick}
        aria-label={secondaryActionLabel || "Regenerate"}
        title={secondaryActionLabel || "Regenerate"}
      >
        ↻
      </DangerousButton>
    ) : (
      <button
        type="button"
        className="word-exercise-header-secondary-action"
        onClick={onSecondaryActionClick}
        disabled={secondaryActionDisabled}
        aria-label={secondaryActionLabel || "Regenerate"}
        title={secondaryActionLabel || "Regenerate"}
      >
        ↻
      </button>
    )
  ) : null;

  if (!onClick) {
    return (
      <div className={classes} role="columnheader">
        {content}
        {secondaryAction}
      </div>
    );
  }

  return (
    <div className={classes} role="columnheader">
      <button
        type="button"
        className="word-exercise-header-primary-action"
        onClick={onClick}
        disabled={disabled}
      >
        {content}
      </button>
      {secondaryAction}
    </div>
  );
}

export default function WordExerciseGrid({
  ariaLabel,
  columns,
  rows,
  primaryEntry,
  className = "",
  targetClassName = "",
  columnMinWidth = "132px",
  rowHeaderWidth = "40px",
}: WordExerciseGridProps): JSX.Element {
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `${rowHeaderWidth} repeat(${columns.length}, minmax(${columnMinWidth}, 1fr))`,
  };

  return (
    <div className={`word-exercise-wrap ${className}`.trim()}>
      {primaryEntry ? (
        <button
          type="button"
          className={`word-exercise-cell word-exercise-entry word-exercise-primary-button ${primaryEntry.selected ? "word-exercise-selected" : ""}`}
          onClick={primaryEntry.onClick}
          disabled={primaryEntry.disabled}
        >
          <span className={`word-exercise-target-text ${targetClassName}`.trim()}>{primaryEntry.entry.target}</span>
          {primaryEntry.detailText ? (
            <span className="word-exercise-detail-text">{primaryEntry.detailText}</span>
          ) : null}
          <small>{primaryEntry.entry.source}</small>
        </button>
      ) : null}
      <div className="word-exercise-grid" role="table" aria-label={ariaLabel} style={gridStyle}>
        <div className="word-exercise-cell word-exercise-corner" role="columnheader" />
        {columns.map((column) => (
          <HeaderCell
            key={column.key}
            label={column.label}
            sublabel={column.sublabel}
            selected={column.selected}
            onClick={column.onClick}
            disabled={column.disabled}
            secondaryActionLabel={column.secondaryActionLabel}
            secondaryActionDisabled={column.secondaryActionDisabled}
            secondaryActionRequiresConfirm={column.secondaryActionRequiresConfirm}
            onSecondaryActionClick={column.onSecondaryActionClick}
          />
        ))}
        {rows.flatMap((row) => (
          [
            <HeaderCell
              key={`${row.key}-header`}
              label=""
              sublabel=""
              selected={row.selected}
              onClick={row.onClick}
              disabled={row.disabled}
              className="word-exercise-row-header"
            />,
            ...row.cells.map((cell) => {
            if (!cell.entry) {
              return (
                <div key={cell.key} className="word-exercise-cell word-exercise-entry" role="cell">
                  <span className="manage-item-meta">{cell.placeholder || "-"}</span>
                </div>
              );
            }
            return (
              <button
                key={cell.key}
                type="button"
                className={`word-exercise-cell word-exercise-entry ${cell.selected ? "word-exercise-selected" : ""}`}
                onClick={cell.onClick}
                disabled={cell.disabled}
              >
                <span className={`word-exercise-target-text ${targetClassName}`.trim()}>{cell.entry.target}</span>
                <small>{cell.entry.source}</small>
              </button>
              );
            }),
          ]
        ))}
      </div>
    </div>
  );
}
