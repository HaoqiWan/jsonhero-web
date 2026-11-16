import { validateJson } from "../app/utilities/validateJson";

describe("JSON editor validation", () => {
  test.each(['{}', '[]', 'null', 'false', '0', '""', '"hello"', '{"nested":[1,true,null]}'])
    ("accepts the JSON value %s", text => {
      expect(validateJson(text)).toEqual({ valid: true, value: JSON.parse(text) });
    });

  test.each(['', '   ', '{"a":}', '{"a":1,}', '[1,]', '{a:1}', '// comment\n{}', '{} {}', 'undefined', 'NaN', '"raw\nnewline"'])
    ("rejects invalid JSON %j", text => {
      expect(validateJson(text).valid).toBe(false);
    });

  test("locates an error in a multiline document", () => {
    expect(validateJson('{\r\n  "value": ]\r\n}')).toMatchObject({ valid: false, line: 2, column: 12 });
  });

  test("locates missing closing brackets at the end", () => {
    expect(validateJson('[\n  1')).toMatchObject({ valid: false, line: 2, column: 4 });
  });

  test("validates syntax without imposing the previously inferred schema", () => {
    expect(validateJson('{"value":"changed from a number"}').valid).toBe(true);
  });
});
