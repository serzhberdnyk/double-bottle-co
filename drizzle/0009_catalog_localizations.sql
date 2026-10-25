-- Independent translations: no catalog releases, drafts, rates or roles changed.
CREATE TABLE IF NOT EXISTS catalog_localizations (
  locale TEXT NOT NULL CHECK(locale IN ('en','th')),
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  published_text TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY(locale, source_text)
);
