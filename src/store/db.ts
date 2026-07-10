import Database from "better-sqlite3";
import { settings } from "../config.js";

export const db = new Database(settings.DB_PATH);
db.pragma("journal_mode = WAL");
export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS run (
      id             TEXT PRIMARY KEY,
      task           TEXT NOT NULL,
      status         TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      finished_at    TEXT,
      total_tokens   INTEGER DEFAULT 0,
      total_cost_usd REAL    DEFAULT 0,
      duration_ms    INTEGER,
      final_output   TEXT
    );

    CREATE TABLE IF NOT EXISTS step (
      id                TEXT PRIMARY KEY,
      run_id            TEXT NOT NULL REFERENCES run(id),
      ordinal           INTEGER NOT NULL,
      agent_name        TEXT NOT NULL,
      instruction       TEXT,
      output            TEXT,
      prompt_tokens     INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      cost_usd          REAL    DEFAULT 0,
      latency_ms        INTEGER,
      status            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tool_call (
      id         TEXT PRIMARY KEY,
      step_id    TEXT NOT NULL REFERENCES step(id),
      tool_name  TEXT NOT NULL,
      args_json  TEXT,
      result     TEXT,
      latency_ms INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_step_run ON step(run_id);
    CREATE INDEX IF NOT EXISTS idx_tool_step ON tool_call(step_id);
  `);
}