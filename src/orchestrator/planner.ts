import { chat } from "../llm.js";
import { plannerMdoel } from "../config.js";
import { listAgents } from "../agents/registry.js";

export type PlannerAction = 
| {action: "call_agent"; agent: string; instruction: string}
| {action: "finish"; answer: string};

function systemPrompt(task: string): string{
    const agentList = listAgents().map((a)=> `-${a.name}: ${a.description}`).join("\n");
     return `You are the orchestrator/planner for a team of specialist agents.
        Decide the NEXT single action to accomplish the user's task.

        Available agents:
        ${agentList}

        Respond with STRICT JSON only, no prose, in one of these shapes:
        {"action":"call_agent","agent":"<name>","instruction":"<what this agent should do now>"}
        {"action":"finish","answer":"<final answer to the user>"}

        Rules:
        - Call agents one at a time; use their outputs (given to you as history) to decide the next step.
        - When the task is fully addressed, return "finish" with the complete final answer.

        The user's task: ${task}`;
}

function extractJson(text: string): string{
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    return start >= 0 && end > start ? text.slice(start, end+1): text;
}

function parseAction(text: string): PlannerAction | null {
    try {
        const obj = JSON.parse(extractJson(text));
        if(obj.action === "call_agent" && typeof obj.agent === "string" && typeof obj.instruction === "string")
        {
            return obj;
        }
        if(obj.action === "finish" && typeof obj.answer === "string") return obj;
        return null
    } catch {
        return null
    }
}

export async function planNext(task: string, history: string): Promise<PlannerAction> {
  const messages = [
    { role: "system" as const, content: systemPrompt(task) },
    {
      role: "user" as const,
      content: history || "No steps taken yet. Decide the first action.",
    },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await chat({
      messages,
      model: plannerMdoel,
      temperature: 0.2,
      responseFormat: { type: "json_object" },
    });
    const parsed = parseAction(result.content);
    if (parsed) return parsed;
    messages.push({ role: "system", content: result.content });
    messages.push({
      role: "user",
      content: "That was not valid JSON in the required shape. Respond with ONLY the JSON.",
    });
  }

  return { action: "finish", answer: "Planner failed to produce a valid action." };
}