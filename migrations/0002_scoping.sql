-- 0002_scoping.sql — scoping assistant v2 runs 저장
-- Ref: docs/superpowers/specs/2026-04-23-scoping-assistant-design-v2.md §9
-- Ref: docs/plans/feature-scoping-assistant-v2.md Task 3

CREATE TABLE scoping_runs (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id),
  rule_pack_version  TEXT NOT NULL,
  input_json         TEXT NOT NULL,
  output_json        TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at         TEXT
);

CREATE INDEX scoping_runs_project ON scoping_runs(project_id, created_at DESC);
CREATE INDEX scoping_runs_deleted ON scoping_runs(deleted_at);
