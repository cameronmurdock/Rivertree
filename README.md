# Guestbook with Notion Backend

A guestbook application that stores entries in a Notion database, powered by Cloudflare Workers for the backend and deployed via GitHub Pages.

## Features

- Simple, responsive guestbook form
- Entries stored in Notion database
- Rate limiting (optional)
- Deployed via GitHub Pages
- Cloudflare Worker backend for form processing

## Project Structure

```
.
├── .github/workflows/    # GitHub Actions workflow for deployment
├── src/                   # Cloudflare Worker source code
│   └── index.js          # Worker entry point
├── _headers              # Custom headers for CORS
├── .nojekyll             # Ensures all files are included in GitHub Pages
├── guestbook.html        # Guestbook form
├── index.html            # Landing page
└── wrangler.toml         # Cloudflare Worker configuration
```

## Setup

### 1. Notion Setup

1. Create a new Notion integration at [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new database in Notion with these columns:
   - "Name" (Title)
   - "Email" (Email)
   - "Message" (Rich Text)
   - "Membership Type" (Multi-select)
   - "Guestbook Date" (Date)
3. Share the database with your integration
4. Note your Database ID from the URL

### 2. Cloudflare Worker Setup

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```
2. Login to Cloudflare:
   ```bash
   wrangler login
   ```
3. Set up secrets:
   ```bash
   wrangler secret put NOTION_SECRET
   # Paste your Notion secret when prompted

   wrangler secret put NOTION_DB
   # Paste your Notion Database ID when prompted
   ```

### 3. GitHub Pages Deployment

1. Push your code to a GitHub repository
2. Go to Settings > Pages
3. Select GitHub Actions as the source
4. The workflow will automatically deploy to GitHub Pages

## Development

### Local Testing

1. Start the Cloudflare Worker locally:
   ```bash
   wrangler dev
   ```
2. Open `guestbook.html` in a local server (e.g., `python3 -m http.server`)
3. Test the form submission

## Deployment

### Cloudflare Worker

Deploy the worker to Cloudflare:
```bash
wrangler deploy
```

### Frontend

The frontend is automatically deployed to GitHub Pages when you push to the `main` branch.

This will output the URL of your deployed worker (e.g., `your-worker-name.your-subdomain.workers.dev`). Use this URL in your frontend form's fetch request.

## Usage

1. **Update Frontend:** Ensure your frontend form's `fetch` URL points to your deployed worker.
2. **Submit the Form:** Submissions will appear as new rows in your Notion database.

## Environment Variables

| Variable         | Required | Description                                                                 |
|------------------|----------|-----------------------------------------------------------------------------|
| `NOTION_SECRET`  | Yes      | Your Notion Internal Integration Token (starts with `secret_`).             |
| `NOTION_DB`      | Yes      | The ID of your Notion database.                                             |
| `NOTION_VERSION` | No       | The Notion API version (defaults to `2022-06-28` if not set in `wrangler.toml`). |

## Rate Limiting (Optional)

To enable rate limiting:

1. Create a KV namespace:
   ```bash
   wrangler kv:namespace create RATE_KV
   wrangler kv:namespace create RATE_KV --preview
   ```
2. Update `wrangler.toml` with the KV namespace IDs.
3. Uncomment the rate limiting code in `src/index.js`.

## Troubleshooting

- **403 Forbidden:** Ensure your Notion integration has been shared with the database.
- **400 Bad Request:** Check that the property names in your worker code match those in your Notion database exactly.
- **Rate Limiting Issues:** Ensure the KV namespace is properly configured and the worker has the correct permissions.
- **CORS Errors:** Make sure your frontend URL is allowed in the CORS headers.

## License

MIT
