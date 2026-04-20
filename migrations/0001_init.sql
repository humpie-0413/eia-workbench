-- 0001_init.sql — project-shell v0

CREATE TABLE projects (
  id                    TEXT PRIMARY KEY,
  owner_id              TEXT,
  name                  TEXT NOT NULL,
  industry              TEXT NOT NULL CHECK(industry IN ('onshore_wind')),
  site_region_code      TEXT,
  site_region           TEXT,
  site_sub_region_code  TEXT,
  site_sub_region       TEXT,
  capacity_mw           REAL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at            TEXT
);
CREATE INDEX projects_created_at ON projects(created_at);
CREATE INDEX projects_deleted_at ON projects(deleted_at);

CREATE TABLE uploads (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  r2_key          TEXT NOT NULL,
  sha256          TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  mime            TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);
CREATE INDEX uploads_project_id ON uploads(project_id);
CREATE INDEX uploads_deleted_at ON uploads(deleted_at);
CREATE UNIQUE INDEX uploads_project_sha_alive
  ON uploads(project_id, sha256) WHERE deleted_at IS NULL;

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  ok INTEGER NOT NULL
);
CREATE INDEX login_attempts_ip_ts ON login_attempts(ip, ts);
