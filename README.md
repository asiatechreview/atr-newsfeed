# ATR Newsfeed

Cloudflare Pages + Pages Functions + D1 app for the public Asia Tech Review feed.

## What It Does

- Renders a public feed at `feed.asiatechreview.com`.
- Stores feed items in Cloudflare D1.
- Exposes a token-protected ingest endpoint for the ATR automation.
- Provides JSON and RSS output.

## Structure

- `public/` - static frontend for Cloudflare Pages
- `functions/` - Pages Functions API routes
- `schema.sql` - D1 schema
- `wrangler.toml` - Cloudflare config placeholder

## Local Checks

```bash
npm run check
```

No package install is required for the static check. `wrangler` is only needed for local Cloudflare emulation and deployment.

## Cloudflare Setup

1. Create the ATR Cloudflare account and add `asiatechreview.com`.
2. Create a D1 database:

```bash
npx wrangler d1 create atr-feed-db
```

3. Copy the returned `database_id` into `wrangler.toml`.
4. Apply the schema:

```bash
npx wrangler d1 execute atr-feed-db --file=./schema.sql
```

For existing databases, run the latest files in `migrations/` instead of recreating the table.

5. Create a Cloudflare Pages project connected to the GitHub repo.
6. Set build output directory to `public`; no build command is required.
7. Add a D1 binding:
   - Binding name: `ATR_FEED_DB`
   - Database: `atr-feed-db`
8. Add a secret:
   - `FEED_INGEST_TOKEN`
9. Add the custom domain:
   - `feed.asiatechreview.com`

## API

### List Items

```http
GET /api/items?limit=100
```

### Ingest Item

```http
POST /api/items
Authorization: Bearer <FEED_INGEST_TOKEN>
Content-Type: application/json
```

Payload:

```json
{
  "blurb": "Indian AI coding startup Emergent raised a $130 million Series C round at a $1.5 billion valuation",
  "quote": "Emergent said it raised a new Series C round led by Example Capital.",
  "commentary": "The round gives India another AI infra company with serious late-stage backing.",
  "sourceName": "TechCrunch",
  "sourceUrl": "https://techcrunch.com/example",
  "category": "Deals",
  "telegramMessageId": "17940",
  "publishedAt": "2026-07-16T01:00:00Z"
}
```

The frontend renders the source as `[TechCrunch]`, with only the outlet name linked.

For commentary-style posts, `quote`/`quoteBlurb` stores the quoted source blurb and `commentary` stores Jon's note. Plain feed items can continue to send only `blurb`.

### Health

```http
GET /api/health
```

### Feeds

- `/feed.json`
- `/rss.xml`

## Automation Contract

After a blurb is successfully posted to ATR News Feed and archived to the AUTO Google Doc, the automation can call `POST /api/items` with the same finished blurb and source metadata.

If website ingest fails, it should be reported separately and must not imply the Telegram post failed.
