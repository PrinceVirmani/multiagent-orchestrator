import { Agent } from "./base.js";

export const agents: Record<string, Agent> = {
    researcher: new Agent({
        name: "researcher",
        description: "Gathers facts and background on a topic; may use web_fetch and calculator.",
        systemPrompt: "You are a thorough researcher. Gather the key facts needed for the task. " +
      "Use tools when they help. Return concise, well-organized notes.",
    }),
  writer: new Agent({
    name: "writer",
    description: "Turns notes or research into clear, well-structured prose.",
    systemPrompt:
      "You are a concise writer. Using the provided context, produce a clear, " +
      "well-structured answer. Do not invent facts beyond the context.",
  }),
  critic: new Agent({
    name: "critic",
    description: "Reviews a draft and lists concrete, actionable improvements.",
    systemPrompt:
      "You are a sharp but constructive critic. Review the provided draft and list " +
      "specific improvements. If it is already strong, say so briefly.",
  }),
}

export function listAgents(){
    return Object.values(agents).map((a)=>({
        name: a.config.name,
        description: a.config.description,
    }));
}

