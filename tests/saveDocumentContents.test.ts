jest.mock("../app/utilities/safeFetch", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../app/utilities/xml/createFromRawXml", () => ({ __esModule: true, default: jest.fn() }));
import { saveDocumentContents, RawJsonDocument } from "../app/jsonDoc.server";

const document: RawJsonDocument = { id: "same-id", title: "Example", type: "raw", contents: "{}", readOnly: false };
const put = jest.fn();
const list = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  (global as any).DOCUMENTS = { put, list };
  list.mockResolvedValue({ keys: [{ name: document.id }] });
});
afterEach(() => { delete (global as any).DOCUMENTS; });

test("updates the same key and preserves document attributes, expiry and metadata", async () => {
  const expiration = Math.floor(Date.now() / 1000) + 3600;
  list.mockResolvedValue({ keys: [{ name: document.id, expiration, metadata: { owner: "example" } }] });
  await saveDocumentContents(document, '{"saved":true}');
  expect(put).toHaveBeenCalledWith(document.id, JSON.stringify({ ...document, contents: '{"saved":true}' }), {
    expiration, metadata: { owner: "example" },
  });
});

test("does not add an expiry to a permanent document", async () => {
  await saveDocumentContents(document, "null");
  expect(put.mock.calls[0][2].expiration).toBeUndefined();
  expect(JSON.parse(put.mock.calls[0][1]).contents).toBe("null");
});

test("does not recreate a document that expired or was deleted", async () => {
  list.mockResolvedValue({ keys: [] });
  await expect(saveDocumentContents(document, "{}")).rejects.toThrow("Document no longer exists");
  expect(put).not.toHaveBeenCalled();
});

test("does not persist malformed JSON", async () => {
  await expect(saveDocumentContents(document, "{")).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
});

test("propagates storage failures", async () => {
  put.mockRejectedValue(new Error("write failed"));
  await expect(saveDocumentContents(document, "{}")).rejects.toThrow("write failed");
});
