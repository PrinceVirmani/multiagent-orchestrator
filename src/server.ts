import express, { Request, Response } from "express";
import { settings } from "./config.js";
import { initDb } from "./store/db.js";
import * as repo from "./store/repository.js";
import { startRun } from "./orchestrator/engine.js";
import { bus } from "./events.js";
import { listAgents } from "./agents/registry.js";
import { listTools } from "./tools/index.js";

export function createServer() {
  initDb();
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", model: settings.OPENROUTER_MODEL });
  });

  app.get("/agents", (_req: Request, res: Response) => {
    res.json(listAgents());
  });

  app.get("/tools", (_req: Request, res: Response) => {
    res.json(listTools());
  });

  app.post("/runs", (req: Request, res: Response) => {
    const task = req.body?.task;
    if (typeof task !== "string" || !task.trim()) {
      res.status(400).json({ error: "task (string) is required" });
      return;
    }
    const runId = startRun(task);
    res.status(202).json({ run_id: runId });
  });

  app.get("/runs", (_req: Request, res: Response) => {
    res.json(repo.listRuns());
  });

  app.get("/runs/:id", (req: Request<{ id: string }>, res: Response) => {
    const run = repo.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: "run not found" });
      return;
    }
    res.json(run);
  });

  app.get("/runs/:id/stream", (req: Request<{ id: string }>, res: Response) => {
    const runId = req.params.id;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ runId })}\n\n`);

    const unsubscribe = bus.subscribe(runId, (event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      if (event.type === "run_finished" || event.type === "error") {
        res.end();
      }
    });

    req.on("close", unsubscribe);
  });

  return app;
}