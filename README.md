# multiagent-orchestrator
A small multi-agent orchestration server built with Express and TypeScript. You give it a task, a planner LLM breaks it down and delegates to a team of specialist agents (researcher, writer, critic), the agents use tools when they need them, and you get back a final answer along with a full trace of every step, tool call, token count, and cost.

Everything is persisted in SQLite, and you can watch a run unfold live over Server-Sent Events.
