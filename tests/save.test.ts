import { action } from "../app/routes/actions/$id/save";
import { saveDocumentContents, getDocument } from "../app/jsonDoc.server";

jest.mock("remix", () => ({
  json: (data: unknown, init?: number | ResponseInit) => ({
    status: typeof init === "number" ? init : init?.status ?? 200,
    headers: new Map(Object.entries(typeof init === "object" ? init.headers ?? {} : {})),
    json: async () => data,
  }),
}));
jest.mock("../app/jsonDoc.server", () => ({ getDocument: jest.fn(), saveDocumentContents: jest.fn() }));

const source = { id: "original", type: "raw" as const, title: "Example", contents: '{"a":1}', readOnly: false };
const getDoc = getDocument as jest.MockedFunction<typeof getDocument>;
const update = saveDocumentContents as jest.MockedFunction<typeof saveDocumentContents>;

async function submit(body: string, method = "POST") {
  return await action({
    request: { method, json: async () => JSON.parse(body) } as Request,
    params: { id: "original" }, context: {},
  }) as Response;
}

beforeEach(() => {
  jest.resetAllMocks();
  getDoc.mockResolvedValue(source);
  update.mockResolvedValue(undefined);
});

test.each(['{"edited":true}', 'null', 'false', '0', '""'])
  ("updates the same document with %s", async contents => {
    const response = await submit(JSON.stringify({ contents }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "original" });
    expect(update).toHaveBeenCalledWith(source, contents);
    expect(source.contents).toBe('{"a":1}');
  });

test("rejects in-place saves for remote documents", async () => {
  getDoc.mockResolvedValue({ id: "original", type: "url", title: "Remote", url: "https://example.com/data.json", readOnly: false });
  expect((await submit(JSON.stringify({ contents: "[1,2]" }))).status).toBe(409);
  expect(update).not.toHaveBeenCalled();
});

test.each(['{"a":}', '{"a":1,}', '', 'undefined'])
  ("rejects invalid content on the server: %j", async contents => {
    expect((await submit(JSON.stringify({ contents }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

test.each(['not-json', 'null', '{}', '{"contents":{}}'])
  ("rejects malformed requests: %s", async body => {
    expect((await submit(body)).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

test("enforces read-only documents on the server", async () => {
  getDoc.mockResolvedValue({ ...source, readOnly: true });
  expect((await submit('{"contents":"{}"}')).status).toBe(403);
  expect(update).not.toHaveBeenCalled();
});

test("handles a deleted source document", async () => {
  getDoc.mockResolvedValue(undefined);
  expect((await submit('{"contents":"{}"}')).status).toBe(404);
  expect(update).not.toHaveBeenCalled();
});

test("does not report success when persistence fails", async () => {
  update.mockRejectedValue(new Error("KV unavailable"));
  const response = await submit('{"contents":"{}"}');
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Could not save JSON. Please try again." });
});

test("rejects unsupported methods", async () => {
  const response = await submit('{"contents":"{}"}', "PUT");
  expect(response.status).toBe(405);
  expect(response.headers.get("Allow")).toBe("POST");
  expect(update).not.toHaveBeenCalled();
});
