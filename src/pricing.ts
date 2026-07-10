import type { Usage } from "./llm.js";

const PRICES: Record<string, {prompt: number; completions: number}> = {
    "openai/gpt-oss-120b": {prompt: 0.09, completions: 0.45},
};

export function estimatedCost(model: string, usage: Usage): number {
    const p = PRICES[model];
    if(!p) return 0;
    return (
        (usage.prompt_tokens * p.prompt + usage.completion_tokens * p.completions)/ 1_000_000
    );
}


