import { settings } from "./config.js";

export class LLMError extends Error {}

export interface ToolCall{
    id : string;
    type: "function";
    function: {name: string; arguments: string};
}

export interface ChatMessage {
    role : "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id? : string;
    name?: string;
}

export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface ChatResult {
    content: string;
    toolCalls : ToolCall[]
    usage: Usage | null;
}

export interface ChatOptions {
    messages: ChatMessage[];
    model? : string;
    temperature? : number;
    maxTokens?: number;
    tools?: unknown;
    toolChoice?: "auto" | "none" | "required";
    responseFormat?: {type: "json_object"};
}

function headers(): Record<string, string>{
    return {
        Authorization: `Bearer ${settings.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": settings.SITE_URL,
        "X-Title": settings.APP_NAME,
    };
}

function buildBody(opts: ChatOptions, stream: boolean){
    return {
        model: opts.model ?? settings.OPENROUTER_MODEL,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        ...(stream ? {stream: true, stream_options: {include_usage: true}}:{}),
        ...(opts.tools ? { tools: opts.tools, tool_choice: opts.toolChoice ?? "auto" } : {}),
        ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
    };
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
    const url = `${settings.OPENROUTER_BASE_URL}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), settings.REQUEST_TIMEOUT_MS);

    let resp: Response;
    try{
        resp = await fetch(url, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(buildBody(opts, false)),
            signal: controller.signal,
        });
    }
    catch(err){
        throw new LLMError(`Network error calling OpenRouter: ${(err as Error).message}`)
    }
    finally{
        clearTimeout(timer);
    }


    if(!resp.ok){
        throw new LLMError(`Openrouter returned ${resp.status}: ${await resp.text()}`);
    }

    const data = (await resp.json()) as any;
    const message = data.choices?.[0]?.message;
    if(!message) throw new LLMError(`Unexpected response shape: ${JSON.stringify(data)}`);

    return {
        content: message.content ?? "",
        toolCalls : (message.tool_calls as ToolCall[]?? []),
        usage: (data.usage as Usage) ?? null,
    };
}


export type StreamEvent = 
| {type : "token" ; text: string}
| {type: "tool_call"; toolCalls: ToolCall[]}
| {type: "usage"; usage: Usage};

export async function* streamChat(opts: ChatOptions): AsyncGenerator<StreamEvent>{
    const url = `${settings.OPENROUTER_BASE_URL}/chat/completions`;
    const resp = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(buildBody(opts, true)),
    });


    if(!resp.ok || !resp.body){
        throw new LLMError(
            `OpenRouter stream error ${resp.status}: ${(await resp.text().catch(()=>""))}`,

        )

    }


    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const toolAcc: Record<number, ToolCall> = {};
    let streamDone = false;

    while(!streamDone){
        const {done, value} = await reader.read();
        if(done) break;

        buffer += decoder.decode(value, {stream: true});

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for(const line of lines){
            const trimmed = line.trim();
            if(!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if(payload === "[DONE]"){
                streamDone = true;
                break;
            }


            let chunk : any;
            try{
                chunk = JSON.parse(payload);
            }
            catch{
                continue;
            }

            const delta = chunk.choices?.[0]?.delta;

            if (delta?.content) yield { type: "token", text: delta.content };

            if(delta?.tool_calls){
                for(const tc of delta.tool_calls){
                    const idx = tc.index ?? 0;
                    toolAcc[idx] ??= {id: "", type: "function", function: {name: "", arguments: ""}};

                    if(tc.id) toolAcc[idx].id = tc.id;
                    if(tc.function?.name) toolAcc[idx].function.name += tc.function.name;
                    if(tc.function?.arguments) toolAcc[idx].function.arguments += tc.function.arguments;
                }
            }

            if(chunk.usage) yield {type: "usage", usage: chunk.usage as Usage};

        }
    }

        const toolCalls = Object.values(toolAcc);
        if(toolCalls.length) yield {type: "tool_call", toolCalls}; 
}