# Chrome Web Store publishing

Extensions are published as **unlisted** Chrome Web Store items. Anyone with the store link can install them in Chrome, or in Edge after allowing extensions from other
stores, and the store keeps them updated.

After setup, publishing a GitHub release runs [Publish to Chrome Web Store](../.github/workflows/publish-store.yml). It downloads the release ZIPs, checks `SHA256SUMS`, uploads
each extension that has a store item, and submits it for review. The item is published automatically once approved. Review can take from hours to days.

## One-time setup

### 1. Developer account

Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and pay the one-time registration fee. Turn on 2-step verification for the
Google account. Note the dashboard's publisher ID; the workflow needs it.

### 2. First version, uploaded by hand

The API cannot create items, so the first version of each extension is uploaded in the dashboard:

1. Choose **Add new item** and upload `<extension>-<version>.zip` from the latest GitHub release.
2. Fill in **Store listing**, **Privacy practices**, and **Distribution** from the extension's `store/listing.md`. Set visibility to **Unlisted**.
3. Submit for review.
4. Copy the item ID from the dashboard (also the last part of the store URL) into the extension's `store/chrome-web-store.json` as `itemId`, and commit it.

Later releases must have a higher version than the store's current one; release tags guarantee that.

### 3. Google Cloud access for GitHub Actions

The workflow exchanges GitHub's OIDC token for a short-lived access token of a service account through
[Workload Identity Federation](https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account). No key is stored in GitHub.

```sh
PROJECT_ID=your-project-id
REPO=Heehaaw/chrome-extensions

gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com --project="$PROJECT_ID"
gcloud iam service-accounts create chrome-web-store --project="$PROJECT_ID"

gcloud iam workload-identity-pools create github --project="$PROJECT_ID" --location=global \
  --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc chrome-extensions --project="$PROJECT_ID" \
  --location=global --workload-identity-pool=github --display-name="chrome-extensions" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '$REPO'"

POOL=$(gcloud iam workload-identity-pools describe github --project="$PROJECT_ID" --location=global --format='value(name)')
gcloud iam service-accounts add-iam-policy-binding "chrome-web-store@$PROJECT_ID.iam.gserviceaccount.com" \
  --project="$PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/$POOL/attribute.repository/$REPO"

gcloud iam workload-identity-pools providers describe chrome-extensions --project="$PROJECT_ID" \
  --location=global --workload-identity-pool=github --format='value(name)'
```

Then add the service account's email, `chrome-web-store@<project>.iam.gserviceaccount.com`, in the Developer Dashboard's **Account** section. A publisher can link one
service account.

### 4. Repository variables

These values are identifiers, not secrets. In **Settings → Secrets and variables → Actions → Variables**, or with `gh variable set`:

| Variable | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | The provider name printed by the last command, `projects/<number>/locations/global/workloadIdentityPools/github/providers/chrome-extensions` |
| `CWS_SERVICE_ACCOUNT` | `chrome-web-store@<project>.iam.gserviceaccount.com` |
| `CWS_PUBLISHER_ID` | The publisher ID from the Developer Dashboard |

## Releasing

Prepare and publish a GitHub release as described in the [release guidelines](release-guidelines.md). Publishing it starts the store workflow. To submit an existing release
again, for example after fixing the setup, run **Actions → Publish to Chrome Web Store** with its tag.

The workflow uses the extension's `store/chrome-web-store.json` from the release's tagged commit, so an `itemId` committed after a release applies from the next release.
Extensions without an `itemId` are skipped. If the store listing's visibility changes in the dashboard, publish once from the dashboard before the API can publish again.

To check the uploader locally with a token:

```sh
CWS_ACCESS_TOKEN=$(gcloud auth print-access-token --impersonate-service-account=chrome-web-store@<project>.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/chromewebstore) \
  bun scripts/chrome-web-store.js --zip artifacts/release/tab-placement-1.2.3.zip --publisher <publisher-id> --item <item-id> --version 1.2.3
```

Local impersonation needs `roles/iam.serviceAccountTokenCreator` on the service account.
