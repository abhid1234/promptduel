# PromptDuel Deployment Runbook

This document details the deployment, configuration, and rollback procedures for the PromptDuel backend Cloudflare Worker.

## Overview

- **Platform:** Cloudflare Workers (Free Tier)
- **Database/Storage:** Cloudflare KV (Free Tier)
- **Routing:** API endpoints served under `/api/*` on `duel.ondeviceml.space`

---

## 1. Cloudflare Configuration

To deploy the worker, you need a Cloudflare Account and the `wrangler` CLI.

### Creating the KV Namespace

1. Create a production KV namespace via Wrangler:
   ```bash
   npx wrangler kv:namespace create DUELS_KV
   ```
2. Note the namespace ID from the output (e.g. `1a2b3c4d5e6f7g8h9i0j...`).
3. (Optional) Create a preview KV namespace for local testing:
   ```bash
   npx wrangler kv:namespace create DUELS_KV --preview
   ```

### Updating `wrangler.toml`

Replace the placeholder ID in `worker/wrangler.toml` with your production KV namespace ID:

```toml
[[kv_namespaces]]
binding = "DUELS_KV"
id = "<your-production-kv-namespace-id>"
# If you created a preview namespace:
# preview_id = "<your-preview-kv-namespace-id>"
```

---

## 2. Secrets Management

### Local Development Secrets

If your worker needs secret environment variables, configure them locally in a `.dev.vars` file in the `worker/` directory (ignored by git).

### Cloudflare Environment Secrets

Add secrets to Cloudflare via wrangler:
```bash
npx wrangler secret put SECRET_NAME
```

### GitHub Secrets for CI/CD

To authorize the GitHub Actions deployment workflow, add the following secret in your repository settings under **Settings** ➔ **Secrets and variables** ➔ **Actions**:

- **Name:** `CLOUDFLARE_API_TOKEN`
- **Value:** Your Cloudflare API Token (requires `Cloudflare Workers: Edit` permissions).

---

## 3. Deployment Procedures

### Automated Deployment (GitHub Actions)

On pushing or merging to the `main` branch, the GitHub Action defined in `.github/workflows/deploy.yml` automatically:
1. Installs worker dependencies.
2. Deploys the worker to Cloudflare using the `CLOUDFLARE_API_TOKEN` secret.

### Manual Deployment (Ad-hoc)

To deploy manually from your machine:

1. Authenticate wrangler:
   ```bash
   npx wrangler login
   ```
2. Run deployment from the `worker/` directory:
   ```bash
   cd worker
   npm run deploy
   ```

### Local Development / Testing

To run the worker locally:
```bash
cd worker
npm run dev
```
This runs a local HTTP server (usually on port `8787`) using a local simulator for KV storage.

---

## 4. Rollback Procedure

If a deployed worker version causes issues:

### Rollback via Wrangler CLI

You can view deployment history and roll back to a previous version using wrangler commands:

1. List recent deployments to find the version ID:
   ```bash
   npx wrangler deployments list
   ```
2. Roll back to a specific stable deployment ID:
   ```bash
   npx wrangler rollback <deployment-id>
   ```

### Rollback via GitHub Actions

Alternatively, you can trigger a rollback by reverting the commit on the `main` branch:
1. Revert the problematic commit:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```
2. The GitHub Action will run automatically and deploy the reverted codebase.
