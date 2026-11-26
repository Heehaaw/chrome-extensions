import { describe, expect, test } from "bun:test";
import { publishToChromeWebStore } from "./chrome-web-store.js";

const ITEM_PATH = "publishers/pub/items/item";

// Replays canned responses in order and records each request.
function fakeFetch(responses) {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, method: init.method, headers: init.headers, body: init.body });
    const { status = 200, body } = responses.shift();
    return new Response(JSON.stringify(body), { status });
  };
  return { fetchImpl, requests };
}

function publish(fetchImpl, overrides = {}) {
  return publishToChromeWebStore({
    zipBytes: new Uint8Array([1, 2, 3]),
    publisherId: "pub",
    itemId: "item",
    accessToken: "token",
    fetchImpl,
    pollIntervalMs: 0,
    log: () => {},
    ...overrides,
  });
}

describe("publishToChromeWebStore", () => {
  test("Should_upload_then_submit_for_review", async () => {
    const { fetchImpl, requests } = fakeFetch([
      { body: { uploadState: "SUCCEEDED", crxVersion: "1.2.3" } },
      { body: { state: "PENDING_REVIEW" } },
    ]);

    const state = await publish(fetchImpl, { expectedVersion: "1.2.3" });

    expect(state).toBe("PENDING_REVIEW");
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      `POST https://chromewebstore.googleapis.com/upload/v2/${ITEM_PATH}:upload`,
      `POST https://chromewebstore.googleapis.com/v2/${ITEM_PATH}:publish`,
    ]);
    expect(requests[0].headers).toEqual({ authorization: "Bearer token", "content-type": "application/zip" });
    expect(requests[0].body).toEqual(new Uint8Array([1, 2, 3]));
  });

  test.each(["IN_PROGRESS", "UPLOAD_IN_PROGRESS"])("Should_poll_status_while_the_upload_is_%s", async (pending) => {
    const { fetchImpl, requests } = fakeFetch([
      { body: { uploadState: pending } },
      { body: { lastAsyncUploadState: "IN_PROGRESS" } },
      { body: { lastAsyncUploadState: "SUCCEEDED" } },
      { body: { state: "PENDING_REVIEW" } },
    ]);

    await publish(fetchImpl);

    expect(requests.filter((r) => r.url.endsWith(":fetchStatus"))).toHaveLength(2);
  });

  test("Should_not_submit_a_failed_upload", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: { uploadState: "FAILED" } }]);

    await expect(publish(fetchImpl)).rejects.toThrow(/FAILED/);
    expect(requests).toHaveLength(1);
  });

  test("Should_not_submit_a_package_with_an_unexpected_version", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: { uploadState: "SUCCEEDED", crxVersion: "1.0.0" } }]);

    await expect(publish(fetchImpl, { expectedVersion: "1.2.3" })).rejects.toThrow(/expected 1\.2\.3/);
    expect(requests).toHaveLength(1);
  });

  test("Should_report_HTTP_errors_with_the_response_body", async () => {
    const { fetchImpl } = fakeFetch([{ status: 403, body: { error: { message: "denied" } } }]);

    await expect(publish(fetchImpl)).rejects.toThrow(/HTTP 403.*denied/);
  });

  test("Should_stop_polling_after_the_limit", async () => {
    const { fetchImpl } = fakeFetch([
      { body: { uploadState: "IN_PROGRESS" } },
      { body: { lastAsyncUploadState: "IN_PROGRESS" } },
      { body: { lastAsyncUploadState: "IN_PROGRESS" } },
    ]);

    await expect(publish(fetchImpl, { maxPolls: 2 })).rejects.toThrow(/after 2 status checks/);
  });
});
