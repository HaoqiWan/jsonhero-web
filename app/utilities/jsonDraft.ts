import { JSONHeroPath } from "@jsonhero/path";
import jsonMap from "json-source-map";
import { validateJson } from "./validateJson";

export function updateJsonDraft(text: string, previousPreview: unknown) {
  const validation = validateJson(text);
  return { text, validation, preview: validation.valid ? validation.value : previousPreview };
}

// Resolve the most specific key/value under the caret, including compact JSON
// with several fields on one line. Incomplete input must not move the preview.
export function jsonPathAtCursor(text: string, offset: number): string | undefined {
  if (!validateJson(text).valid) return;
  const { pointers } = jsonMap.parse(text);
  let selected = "";
  let smallest = Infinity;
  for (const [pointer, location] of Object.entries(pointers)) {
    const start = location.key?.pos ?? location.value.pos;
    const end = location.valueEnd.pos;
    if (offset >= start && offset <= end && end - start < smallest) {
      selected = pointer;
      smallest = end - start;
    }
  }
  if (selected === "") return "$";
  const path = "$." + selected.slice(1).split("/")
    .map(key => key.replace(/~1/g, "/").replace(/~0/g, "~").replace(/\./g, "\\."))
    .join(".");
  // Some unusual keys cannot be represented by the explorer's path library.
  // Fall back to the document instead of showing a different field.
  return new JSONHeroPath(path).jsonPointer() === selected ? path : "$";
}

export function existingPreviewPath(json: unknown, path: string): string {
  const pointer = new JSONHeroPath(path).jsonPointer();
  if (pointer === "") return "$";
  let value: any = json;
  for (const token of pointer.slice(1).split("/")) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (value === null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, key)) return "$";
    value = value[key];
  }
  return path;
}
