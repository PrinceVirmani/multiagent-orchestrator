import { randomUUID } from "node:crypto";
import { settings } from "../config.js";
import { bus } from "../events.js";
import { planNext } from "./planner.js";
import { agents } from "../agents/registry.js";
import { estimatedCost } from "../pricing.js";
import * as repo from "../store/repository.js";


export function startRun(task: string): string {
  const runId = repo.createRun(task);
  void execute(runId, task);
  return runId;
}

async function execute(runId: string, task: string): Promise<void> {
  const startedAt = Date.now();
  bus.publish(runId, { type: "run_started", runId, task });

  const history: string[] = [];
  let ordinal = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let finalOutput = "";

  try {
    for (let step = 0; step < settings.MAX_STEPS; step++) {
      const action = await planNext(task, history.join("\n\n"));
      bus.publish(runId, { type: "plan_step", runId, action });

      if (action.action === "finish") {
        finalOutput = action.answer;
        break;
      }

      const agent = agents[action.agent];
      if (!agent) {
        history.push(`(planner requested unknown agent '${action.agent}'; skipped)`);
        continue;
      }

      const stepId = randomUUID();
      repo.createStep({
        id: stepId,
        runId,
        ordinal: ordinal++,
        agentName: action.agent,
        instruction: action.instruction,
      });
      bus.publish(runId, {
        type: "step_started",
        runId,
        stepId,
        agent: action.agent,
        instruction: action.instruction,
      });

      const t0 = Date.now();
      const { output, usage } = await agent.run({
        task: action.instruction,
        context: history.join("\n\n"),
        runId,
        stepId,
      });
      const latency = Date.now() - t0;
      const model = agent.config.model ?? settings.OPENROUTER_MODEL;
      const cost = estimatedCost(model, usage);
      totalTokens += usage.total_tokens;
      totalCost += cost;

      repo.finishStep({
        id: stepId,
        output,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        costUsd: cost,
        latencyMs: latency,
        status: "done",
      });
      bus.publish(runId, { type: "step_finished", runId, stepId, output });

      history.push(`[${action.agent}] ${output}`);
      finalOutput = output; 
    }

    repo.finishRun({
      id: runId,
      status: "done",
      finalOutput,
      totalTokens,
      totalCostUsd: totalCost,
      durationMs: Date.now() - startedAt,
    });
    bus.publish(runId, { type: "run_finished", runId, output: finalOutput });
  } catch (err) {
    const message = (err as Error).message;
    repo.finishRun({
      id: runId,
      status: "error",
      finalOutput: message,
      totalTokens,
      totalCostUsd: totalCost,
      durationMs: Date.now() - startedAt,
    });
    bus.publish(runId, { type: "error", runId, message });
  }
}