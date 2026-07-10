import { randomUUID } from "node:crypto";
import { db } from "./db.js";

export function createRun(task: string): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO run (id, task, status, created_at) VALUES (?, ?, 'running', ?)",
  ).run(id, task, new Date().toISOString());
  return id;
}

export function createStep(p: {
  id: string;
  runId: string;
  ordinal: number;
  agentName: string;
  instruction: string;
}): void {
  db.prepare(
    `INSERT INTO step (id, run_id, ordinal, agent_name, instruction, status)
     VALUES (@id, @runId, @ordinal, @agentName, @instruction, 'running')`,
  ).run(p);
}

export function finishStep(p: {
  id: string;
  output: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  status: string;
}): void {
  db.prepare(
    `UPDATE step SET
       output = @output, prompt_tokens = @promptTokens,
       completion_tokens = @completionTokens, cost_usd = @costUsd,
       latency_ms = @latencyMs, status = @status
     WHERE id = @id`,
  ).run(p);
}

export function addToolCall(p: {
  stepId: string;
  toolName: string;
  args: unknown;
  result: string;
  latencyMs: number;
}): void {
  db.prepare(
    `INSERT INTO tool_call (id, step_id, tool_name, args_json, result, latency_ms)
     VALUES (@id, @stepId, @toolName, @argsJson, @result, @latencyMs)`,
  ).run({
    id: randomUUID(),
    stepId: p.stepId,
    toolName: p.toolName,
    argsJson: JSON.stringify(p.args),
    result: p.result,
    latencyMs: p.latencyMs,
  });
}

export function finishRun(p: {
  id: string;
  status: string;
  finalOutput: string;
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
}): void {
  db.prepare(
    `UPDATE run SET
       status = @status, finished_at = @finishedAt, total_tokens = @totalTokens,
       total_cost_usd = @totalCostUsd, duration_ms = @durationMs, final_output = @finalOutput
     WHERE id = @id`,
  ).run({ ...p, finishedAt: new Date().toISOString() });
}

export function getRun(id: string) {
  const run = db.prepare("SELECT * FROM run WHERE id = ?").get(id) as any;
  if (!run) return null;
  const steps = db
    .prepare("SELECT * FROM step WHERE run_id = ? ORDER BY ordinal")
    .all(id) as any[];
  const stepIds = steps.map((s) => s.id);
  const toolCalls = stepIds.length
    ? (db
        .prepare(
          `SELECT * FROM tool_call WHERE step_id IN (${stepIds.map(() => "?").join(",")})`,
        )
        .all(...stepIds) as any[])
    : [];
  return {
    ...run,
    steps: steps.map((s) => ({
      ...s,
      tool_calls: toolCalls.filter((tc) => tc.step_id === s.id),
    })),
  };
}

export function listRuns() {
  return db
    .prepare(
      `SELECT id, task, status, created_at, total_tokens, total_cost_usd, duration_ms
       FROM run ORDER BY created_at DESC LIMIT 50`,
    )
    .all();
}