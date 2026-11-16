import jsonMap from "json-source-map";

export type JsonValidation =
  | { valid: true; value: unknown }
  | { valid: false; message: string; line?: number; column?: number };

/** Strict JSON syntax validation, shared by the editor and its save endpoint. */
export function validateJson(text: string): JsonValidation {
  try {
    return { valid: true, value: JSON.parse(text) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    // V8 reports a character offset; Firefox reports a line and column.
    const position = /position (\d+)/i.exec(message);
    const location = /line (\d+) column (\d+)/i.exec(message);
    let offset = position ? Number(position[1]) : undefined;
    if (offset === undefined && /unexpected end|end of (?:json )?(?:input|data)/i.test(message)) {
      offset = text.length;
    }
    // Some engines abbreviate the native error without providing a location.
    // Only use source-map parsing to locate errors; JSON.parse decides validity.
    if (offset === undefined && !location) {
      try {
        jsonMap.parse(text);
      } catch (mappedError) {
        const detail = mappedError instanceof Error ? mappedError.message : "";
        const mappedPosition = /position (\d+)/i.exec(detail);
        if (mappedPosition) offset = Number(mappedPosition[1]);
        else if (/unexpected end/i.test(detail)) offset = text.length;
      }
    }
    if (!text.trim()) offset = 0;
    if (offset !== undefined) {
      const lines = text.slice(0, offset).split(/\r\n|\r|\n/);
      return { valid: false, message, line: lines.length, column: lines[lines.length - 1].length + 1 };
    }
    return {
      valid: false,
      message,
      ...(location ? { line: Number(location[1]), column: Number(location[2]) } : {}),
    };
  }
}
