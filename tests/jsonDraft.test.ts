import { JSONHeroPath } from "@jsonhero/path";
import { existingPreviewPath, jsonPathAtCursor, updateJsonDraft } from "../app/utilities/jsonDraft";

describe("live JSON preview", () => {
  test("keeps the last valid preview through incomplete edits, then resumes", () => {
    const initial = updateJsonDraft('{"name":"before"}', undefined);
    const changed = updateJsonDraft('{"renamed":[1,2]}', initial.preview);
    expect(changed.preview).toEqual({ renamed: [1, 2] });
    const invalid = updateJsonDraft('{"renamed":[1,', changed.preview);
    expect(invalid.validation.valid).toBe(false);
    expect(invalid.preview).toBe(changed.preview);
    const resumed = updateJsonDraft('{"renamed":null}', invalid.preview);
    expect(resumed.preview).toEqual({ renamed: null });
    expect(initial.preview).toEqual({ name: "before" });
  });

  test.each(['null', 'false', '0', '""', '[]', '{}'])("updates to %s without a truthiness fallback", text => {
    expect(updateJsonDraft(text, { old: true }).preview).toEqual(JSON.parse(text));
  });

  test("selects fields independently on the same line, including renamed keys", () => {
    const text = '{"name":"alpha","renamed":"beta"}';
    expect(jsonPathAtCursor(text, text.indexOf("alpha") + 2)).toBe("$.name");
    expect(jsonPathAtCursor(text, text.indexOf("renamed") + 2)).toBe("$.renamed");
    expect(jsonPathAtCursor(text, text.indexOf("beta") + 2)).toBe("$.renamed");
  });

  test("selects the innermost value in a nested array", () => {
    const text = '{\n "items": [{"value":42}, {"value":99}]\n}';
    const path = jsonPathAtCursor(text, text.indexOf("99") + 1)!;
    expect(new JSONHeroPath(path).first(JSON.parse(text))).toBe(99);
  });

  test("handles escaped JSON pointer keys", () => {
    const text = '{"a/b~c":"escaped"}';
    const path = jsonPathAtCursor(text, text.indexOf("escaped") + 2)!;
    expect(new JSONHeroPath(path).first(JSON.parse(text))).toBe("escaped");
  });

  test("does not select against an invalid draft", () => {
    expect(jsonPathAtCursor('{"name":', 5)).toBeUndefined();
    expect(jsonPathAtCursor('{"name":1,}', 5)).toBeUndefined();
  });

  test("selects root at document boundaries and for primitive roots", () => {
    expect(jsonPathAtCursor('{"value":1}', 0)).toBe("$");
    expect(jsonPathAtCursor('{"value":1}', 11)).toBe("$");
    expect(jsonPathAtCursor('false', 3)).toBe("$");
  });

  test("falls back to root after deleting a field or replacing its parent", () => {
    expect(existingPreviewPath({}, "$.deleted")).toBe("$");
    expect(existingPreviewPath({ parent: null }, "$.parent.child")).toBe("$");
    expect(existingPreviewPath({ parent: 1 }, "$.parent.child")).toBe("$");
    expect(existingPreviewPath(null, "$.parent")).toBe("$");
    expect(existingPreviewPath({ value: null }, "$.value")).toBe("$.value");
    expect(existingPreviewPath({ value: false }, "$.value")).toBe("$.value");
    expect(existingPreviewPath([], "$.constructor")).toBe("$");
  });
});
