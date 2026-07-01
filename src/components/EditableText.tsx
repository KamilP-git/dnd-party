"use client";

import { useState } from "react";

type EditableTextProps = {
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  title?: string;
};

export function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder = "Kliknij dwa razy, żeby edytować",
  className,
  inputClassName,
  title = "Kliknij dwa razy, żeby edytować",
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEditing() {
    setDraft(value);
    setIsEditing(true);
  }

  function saveDraft() {
    onSave(draft);
    setIsEditing(false);
  }

  function cancelEditing() {
    setDraft(value);
    setIsEditing(false);
  }

  if (isEditing && multiline) {
    return (
      <textarea
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={saveDraft}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancelEditing();
          }

          if (event.key === "Enter" && event.ctrlKey) {
            saveDraft();
          }
        }}
        className={inputClassName}
      />
    );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder={placeholder}
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
      {value || placeholder}
    </button>
  );
}
