export interface Tool{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handlers:(args: Record<string, any>) => Promise<string> | string;
}

const registry = new Map<string, Tool>();

export function defineTool(tool: Tool): void{
    registry.set(tool.name, tool);
}

export function openaiSchema(){
    return [...registry.values()].map((t)=> ({
        type: "function" as const,
        function: {name: t.name, description: t.description, parameters: t.parameters},
    }));
}


export function listTools(){
    return [...registry.values()].map((t)=> ({
        name: t.name,
        description: t.description,
    }))
}


export async function dispatch(name:string, args: Record<string, string>): Promise<string> {
    const tool = registry.get(name);
    if(!tool) return `Error Unknown tool "${name}"`;
    try {
        return String(await tool.handlers(args));
    } catch (err) {
        return `Erro running tool '${name}: ${(err as Error).message}`
    }
}