# Notion Form Cloudflare Worker

This worker provides a public endpoint to receive form submissions (JSON) and add them as rows to a specified Notion database.

## Setup

1.  **Install Wrangler CLI:**
    ```bash
    npm install -g wrangler
    ```
2.  **Login to Cloudflare:**
    ```bash
    wrangler login
    ```
3.  **Clone/Set up Project:** Ensure you have `wrangler.toml` and `src/index.js`.
4.  **Configure `wrangler.toml`:**
    *   Set a unique `name` for your worker.
    *   Ensure `main` points to `src/index.js`.
    *   (Optional) Add KV namespace details if using rate limiting.
    *   (Optional) Add `[env.production].routes` if using a custom domain.
5.  **Set Secrets:**
    *   Get your Notion API Key (Internal Integration Token).
    *   Get your Notion Database ID.
    ```bash
    wrangler secret put NOTION_SECRET
    # Paste your Notion secret when prompted

    wrangler secret put NOTION_DB
    # Paste your Notion Database ID when prompted
    ```
6.  **(Optional) Create KV Namespace for Rate Limiting:**
    ```bash
    wrangler kv:namespace create RATE_KV
    wrangler kv:namespace create RATE_KV --preview
    ```
    *   Copy the `id` and `preview_id` into your `wrangler.toml` under `[[kv_namespaces]]`.

## Development

Run a local development server:

```bash
wrangler dev
```

This will typically run on `http://localhost:8787`.

## Deployment

Deploy the worker to your Cloudflare account:

```bash
wrangler deploy
```

This will output the URL of your deployed worker (e.g., `your-worker-name.your-subdomain.workers.dev`). Use this URL in your frontend form's fetch request.

## Notion Database Setup

Ensure your Notion database has the following properties (names must match the `src/index.js` code):

*   `Name` (Type: Title)
*   `Email` (Type: Email)
*   `Message` (Type: Rich Text)
*   (Optional) `Timestamp` (Type: Date or Created Time)

Share the database with the Integration you created to get the `NOTION_SECRET`.
