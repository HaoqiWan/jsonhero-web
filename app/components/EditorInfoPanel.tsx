import { useLocation } from "remix";
import { JsonSnapshotProvider } from "~/hooks/useJson";
import { JsonPreviewSelectionProvider } from "~/hooks/useJsonColumnView";
import { useJsonDoc } from "~/hooks/useJsonDoc";
import { useJsonDraft } from "~/hooks/useJsonDraft";
import { JsonSchemaProvider } from "~/hooks/useJsonSchema";
import { InfoPanel } from "./InfoPanel";

export function EditorInfoPanel() {
  const { pathname } = useLocation();
  const { doc } = useJsonDoc();
  const draft = useJsonDraft();
  if (doc.readOnly || !pathname.endsWith("/editor")) return <InfoPanel />;

  return <JsonSnapshotProvider json={draft.preview}>
    <JsonSchemaProvider>
      <JsonPreviewSelectionProvider path={draft.previewPath} onSelect={draft.setPreviewPath}>
        <InfoPanel notice={draft.validation.valid ? "Live preview" : "Preview paused — showing last valid JSON"} />
      </JsonPreviewSelectionProvider>
    </JsonSchemaProvider>
  </JsonSnapshotProvider>;
}
