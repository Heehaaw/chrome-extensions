// Uploads a release ZIP to an existing Chrome Web Store item and submits it for review, using the
// Chrome Web Store API v2. The item must already exist: the API cannot create items.
//
// Usage: CWS_ACCESS_TOKEN=... bun scripts/chrome-web-store.js --zip <file> --publisher <id> --item <id> [--version <x.y.z>]
//
// The access token needs the https://www.googleapis.com/auth/chromewebstore scope. It is read from the
// environment so it never appears in process listings or logs.

import { parseArgs } from "node:util";

const API = "https://chromewebstore.googleapis.com";

/** Uploads zipBytes to the item, waits for processing, submits it, and returns the submission state. */
export async function publishToChromeWebStore({
  zipBytes,
  publisherId,
  itemId,
  accessToken,
  expectedVersion,
  fetchImpl = fetch,
  pollIntervalMs = 5000,
  maxPolls = 60,
  log = console.log,
}) {
  const item = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}`;
  const call = async (method, url, body, contentType) => {
    const response = await fetchImpl(url, {
      method,
      headers: { authorization: `Bearer ${accessToken}`, ...(contentType && { "content-type": contentType }) },
      body,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${url} failed with HTTP ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  };

  const upload = await call("POST", `${API}/upload/v2/${item}:upload`, zipBytes, "application/zip");
  let state = upload.uploadState;
  log(`Upload state: ${state}`);

  // Large packages are processed asynchronously. The upload reference calls the pending state
  // UPLOAD_IN_PROGRESS while the UploadState enum lists IN_PROGRESS, so both are accepted.
  for (let poll = 0; isInProgress(state); poll++) {
    if (poll >= maxPolls) throw new Error(`Upload still processing after ${maxPolls} status checks.`);
    await Bun.sleep(pollIntervalMs);
    state = (await call("GET", `${API}/v2/${item}:fetchStatus`)).lastAsyncUploadState;
    log(`Upload state: ${state}`);
  }
  if (state !== "SUCCEEDED") throw new Error(`Upload ended in state ${state}.`);

  if (expectedVersion && upload.crxVersion && upload.crxVersion !== expectedVersion) {
    throw new Error(`Uploaded package has version ${upload.crxVersion}, expected ${expectedVersion}.`);
  }

  // An empty body uses the defaults: review, then publish on approval with the dashboard's visibility.
  const submission = await call("POST", `${API}/v2/${item}:publish`, "{}", "application/json");
  for (const warning of submission.warningInfo?.warnings ?? []) {
    log(`Warning: ${warning.reason}: ${warning.description}`);
  }
  log(`Submission state: ${submission.state}`);
  return submission.state;
}

function isInProgress(state) {
  return state === "IN_PROGRESS" || state === "UPLOAD_IN_PROGRESS";
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      zip: { type: "string" },
      publisher: { type: "string" },
      item: { type: "string" },
      version: { type: "string" },
    },
  });
  const accessToken = process.env.CWS_ACCESS_TOKEN;
  try {
    if (!values.zip || !values.publisher || !values.item) throw new Error("--zip, --publisher, and --item are required.");
    if (!accessToken) throw new Error("CWS_ACCESS_TOKEN is not set.");
    await publishToChromeWebStore({
      zipBytes: await Bun.file(values.zip).arrayBuffer(),
      publisherId: values.publisher,
      itemId: values.item,
      accessToken,
      expectedVersion: values.version,
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
