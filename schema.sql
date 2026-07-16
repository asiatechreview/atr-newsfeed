CREATE TABLE IF NOT EXISTS feed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blurb TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other news',
  status TEXT NOT NULL DEFAULT 'published',
  telegram_message_id TEXT,
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_items_status_published
ON feed_items (status, published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_feed_items_category
ON feed_items (category);
