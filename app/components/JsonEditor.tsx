import { CodeEditor } from "./CodeEditor";
import { useJson } from "~/hooks/useJson";
import { useCallback, useMemo } from "react";
import {
  useJsonColumnViewAPI,
  useJsonColumnViewState,
} from "~/hooks/useJsonColumnView";
import { ViewUpdate } from "@uiw/react-codemirror";
import jsonMap from "json-source-map";
import { JSONHeroPath } from "@jsonhero/path";
import {usePreferences} from '~/components/PreferencesProvider'
// Modified: validated editing, stable-URL saves and optional copies.
import { useJsonDraft } from "~/hooks/useJsonDraft";
import { useJsonDoc } from "~/hooks/useJsonDoc";
import { jsonPathAtCursor } from "~/utilities/jsonDraft";

export function JsonEditor() {
  const [json] = useJson();
  const { selectedNodeId } = useJsonColumnViewState();
  const { goToNodeId } = useJsonColumnViewAPI();
  const [preferences] = usePreferences();
  const { doc } = useJsonDoc();
  const draft = useJsonDraft();

  const jsonMapped = useMemo(() => {
    return jsonMap.stringify(json, null, preferences?.indent || 2);
  }, [json, preferences]);

  const selection = useMemo<{ start: number; end: number } | undefined>(() => {
    if (!selectedNodeId) {
      return;
    }

    const path = new JSONHeroPath(selectedNodeId);
    const pointer = path.jsonPointer();

    const location = jsonMapped.pointers[pointer];

    if (location) {
      if (location.key) {
        return { start: location.key.pos, end: location.valueEnd.pos };
      }

      return { start: location.value.pos, end: location.valueEnd.pos };
    }
  }, [selectedNodeId, jsonMapped]);

  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      if (!update.docChanged && !update.selectionSet) return;
      const path = jsonPathAtCursor(update.state.doc.toString(), update.state.selection.main.head);
      if (path === undefined) return;
      if (doc.readOnly) {
        if (path !== selectedNodeId) goToNodeId(path, "editor");
      } else {
        draft.setPreviewPath(path);
      }
    },
    [goToNodeId, selectedNodeId, doc.readOnly, draft.setPreviewPath]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200">
        {doc.readOnly ? <span>Read-only document</span> : <>
          {doc.type === "raw" && <button type="button" onClick={draft.save}
            disabled={!draft.dirty || !draft.validation.valid || draft.saving}
            className="rounded-sm px-3 py-1 bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
            {draft.saving ? "Saving…" : "Save"}
          </button>}
          <button type="button" onClick={draft.saveCopy}
            disabled={!draft.validation.valid || draft.saving}
            className="rounded-sm px-3 py-1 bg-slate-200 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
            Save copy
          </button>
          <button type="button" onClick={draft.format} disabled={!draft.validation.valid || draft.saving}
            className="rounded-sm px-3 py-1 bg-slate-200 dark:bg-slate-700 disabled:opacity-50">Format</button>
          <button type="button" onClick={draft.reset} disabled={!draft.dirty || draft.saving}
            className="rounded-sm px-3 py-1 bg-slate-200 dark:bg-slate-700 disabled:opacity-50">Reset</button>
          <span>{draft.dirty ? "Unsaved changes" : "Saved document"}</span>
        </>}
      </div>
      {!doc.readOnly && <div className="px-3 py-2 text-sm border-b border-slate-300 dark:border-slate-600">
        <p role="status" aria-live="polite" className={draft.validation.valid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
          {draft.validation.valid ? "Valid JSON" : `Invalid JSON${draft.validation.line ? ` at line ${draft.validation.line}, column ${draft.validation.column}` : ""}: ${draft.validation.message}`}
        </p>
        <p className="text-slate-500 dark:text-slate-400">{doc.type === "raw" ? "Save updates this document at the same URL. Save copy creates a separate document." : "This document loads from a remote URL. Save copy creates an editable local snapshot."} The right panel previews valid edits live.</p>
        {draft.saveError && <p role="alert" className="text-red-700 dark:text-red-400">{draft.saveError}</p>}
      </div>}
      <CodeEditor
      language="json"
      content={doc.readOnly ? jsonMapped.json : draft.text}
      readOnly={doc.readOnly || draft.saving}
      onChange={draft.edit}
      onUpdate={onUpdate}
      selection={doc.readOnly ? selection : undefined}
      fillHeight={true}
    />
    </div>
  );
}
