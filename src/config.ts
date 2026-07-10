import "dotenv/config";
import {z} from "zod";

const envSchema = z.object({
    OPENROUTER_API_KEY: z.string().min(1, "Openrouter key is required"),
    OPENROUTER_MODEL:z.string().min(1, "Openrouter model is required"),
    OPENROUTER_BASE_URL:z.string().url().default("https://openrouter.ai/api/v1"),
    APP_NAME:z.string().default("multiagent"),
    SITE_URL:z.string().default("http://localhost:8000"),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    DB_PATH:z.string().default("orchestrator.db"),
    PLANNER_MODEL:z.string().optional().transform((v)=>(v && v.trim()? v : undefined)),
    MAX_STEPS: z.coerce.number().int().positive().default(8),
    PORT: z.coerce.number().int().default(8000),
});

const parsed = envSchema.safeParse(process.env);

if(!parsed.success){
    console.error("Invalid env config");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}


export const settings = parsed.data;
export type Settings = typeof settings;

export const plannerMdoel = settings.PLANNER_MODEL ?? settings.OPENROUTER_MODEL;