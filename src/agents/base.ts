import { streamChat, ChatMessage, ToolCall, Usage } from "../llm.js";
import { openaiSchema, dispatch } from "../tools/index.js";
import { bus } from "../events.js";
import { addToolCall } from "../store/repository.js";

export interface AgentConfig{
    name: string;
    description: string;
    systemPrompt: string;
    model?: string;
    temperature?: number;
}

const MAX_TOOL_ITERATIONS = 5;

function emptyUsage(): Usage{
    return {prompt_tokens: 0, completion_tokens: 0, total_tokens: 0};
}

function accumulate(total: Usage, add: Usage | null) : void {
    if(!add) return;
    total.prompt_tokens += add.prompt_tokens?? 0;
    total.completion_tokens += add.completion_tokens ?? 0;
    total.total_tokens += add.total_tokens ?? 0;
}

function safeParseArgs(raw: string): Record<string, any>{
    try{
        return JSON.parse(raw || "{}");
    }
    catch{
        return {};
    }
}


export class Agent{
    constructor(public config: AgentConfig){}

    async run(params: {
        task: string;
        context?: string;
        runId: string;
        stepId: string;
    }): Promise<{output : string; usage: Usage}>{
        const {task, context ="", runId, stepId} = params;
        const userContent = context? `${context}\n\nTask: ${task}` : task;

        const messages: ChatMessage[] = [
            {role: "system", content: this.config.systemPrompt},
            {role: "user", content: userContent},
        ]

        const totalUsage = emptyUsage();

        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++){
            let content = "";
            let toolCalls: ToolCall[] = [];

            for await (const ev of streamChat({
                messages,
                model: this.config.model,
                temperature: this.config.temperature,
                tools: openaiSchema(),
            })) {
                if(ev.type === "token"){
                    content += ev.text;
                    bus.publish(runId, {type: "token", runId, stepId, text: ev.text});
                }
                else if (ev.type === "tool_call"){
                    toolCalls = ev.toolCalls
                } else if (ev.type === "usage"){
                    accumulate(totalUsage, ev.usage);
                }
            }

            if(toolCalls.length === 0){
                return {output: content, usage: totalUsage};
            }

            messages.push({
                role: "assistant", content, tool_calls: toolCalls
            });

            for(const tc of toolCalls){
                const args = safeParseArgs(tc.function.arguments);
                const t0 = Date.now();
                const result = await dispatch(tc.function.name, args);
                addToolCall({
                    stepId,
                    toolName: tc.function.name,
                    args,
                    result,
                    latencyMs: Date.now() - t0,
                });
                bus.publish(runId, {
                    type: "tool_call",
                    runId,
                    stepId,
                    tool: tc.function.name,
                    args,
                    result,
                });
                messages.push({
                    role: "tool", tool_call_id: tc.id, content: result
                });
            }
        }

        return {output: "Stopped: Tool-iteration limit reached.", usage: totalUsage};
    }
}