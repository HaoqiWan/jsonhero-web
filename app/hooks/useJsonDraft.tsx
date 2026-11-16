import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useNavigate } from "remix";
import invariant from "tiny-invariant";
import { updateJsonDraft } from "~/utilities/jsonDraft";
import { usePreferences } from "~/components/PreferencesProvider";
import { useJson } from "./useJson";
import { useJsonDoc } from "./useJsonDoc";

function useDraft() {
  const { doc, onSave } = useJsonDoc();
  const [json] = useJson();
  const [preferences] = usePreferences();
  const navigate = useNavigate();
  // Keep drafts above the view routes, so switching views cannot lose edits.
  const [original] = useState(() => doc.type === "raw"
    ? doc.contents : JSON.stringify(json, null, preferences?.indent || 2));
  const [{ text, validation, preview }, setDraft] = useState(() => updateJsonDraft(original, json));
  const [previewPath, setPreviewPath] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const dirty = text !== original;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(value: string) {
    if (saving || doc.readOnly) return;
    setSaveError(undefined);
    setDraft(previous => previous.text === value ? previous : updateJsonDraft(value, previous.preview));
  }

  async function save(asCopy: boolean) {
    if (saving || doc.readOnly || !validation.valid || (!asCopy && (!dirty || doc.type !== "raw"))) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const response = await fetch(`/actions/${encodeURIComponent(doc.id)}/${asCopy ? "saveCopy" : "save"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: text }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.id !== "string") {
        throw new Error(result.error || "Could not save JSON. Please try again.");
      }
      if (asCopy) navigate(`/j/${encodeURIComponent(result.id)}/editor`);
      else onSave?.(text);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save JSON. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return { text, edit, dirty, validation, preview, previewPath, setPreviewPath, saving, saveError, save: () => save(false), saveCopy: () => save(true),
    reset: () => edit(original),
    format: () => {
      if (validation.valid) edit(JSON.stringify(validation.value, null, preferences?.indent || 2));
    },
  };
}

const JsonDraftContext = createContext<ReturnType<typeof useDraft> | undefined>(undefined);

export function JsonDraftProvider({ children }: { children: ReactNode }) {
  const draft = useDraft();
  return <JsonDraftContext.Provider value={draft}>{children}</JsonDraftContext.Provider>;
}

export function useJsonDraft() {
  const draft = useContext(JsonDraftContext);
  invariant(draft, "useJsonDraft must be used within a JsonDraftProvider");
  return draft;
}
