"use client";

import { useState } from "react";

type EditableNumberProps = {
  value: number;
  onSave: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
  title?: string;
  formatValue?: (value: number) => string;
};

export function EditableNumber({
  value,
  onSave,
  min,
  max,
  className = "",
  inputClassName = "",
  title,
  formatValue,
}: EditableNumberProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function startEditing() {
    setDraft(String(value));
    setIsEditing(true);
  }

  function saveDraft() {
    const parsedValue = Number(draft);

    if (Number.isNaN(parsedValue)) {
      setIsEditing(false);
      return;
    }

    let nextValue = parsedValue;

    if (typeof min === "number") {
      nextValue = Math.max(min, nextValue);
    }

    if (typeof max === "number") {
      nextValue = Math.min(max, nextValue);
    }

    onSave(nextValue);
    setIsEditing(false);
  }

  function cancelEditing() {
    setDraft(String(value));
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={saveDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            saveDraft();
          }

          if (event.key === "Escape") {
            cancelEditing();
          }
        }}
        className={inputClassName}
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={startEditing}
      title={title}
      className={className}
    >
      {formatValue ? formatValue(value) : value}
    </button>
  );
}
