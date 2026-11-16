import { json } from "remix";
import type { ActionFunction } from "remix";
import { saveDocumentContents, getDocument } from "~/jsonDoc.server";
import { validateJson } from "~/utilities/validateJson";

/** Update a local document while keeping its ID and URL. */
export const action: ActionFunction = async ({ request, params }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  const source = params.id ? await getDocument(params.id) : undefined;
  if (!source) return json({ error: "Document not found" }, 404);
  if (source.readOnly) return json({ error: "Document is read-only" }, 403);

  if (source.type !== "raw") return json({ error: "Remote documents must be saved as a copy." }, 409);

  let contents: unknown;
  try {
    contents = (await request.json())?.contents;
  } catch {
    return json({ error: "Expected a JSON request body" }, 400);
  }
  if (typeof contents !== "string") {
    return json({ error: "contents must be a JSON string" }, 400);
  }
  const validation = validateJson(contents);
  if (!validation.valid) {
    return json({ error: validation.message, line: validation.line, column: validation.column }, 400);
  }
  try {
    await saveDocumentContents(source, contents);
    return json({ id: source.id });
  } catch {
    return json({ error: "Could not save JSON. Please try again." }, 500);
  }
};
