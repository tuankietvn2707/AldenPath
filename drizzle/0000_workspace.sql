CREATE TABLE records (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);