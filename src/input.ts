import { Actor } from "apify";

import { z } from "zod";

export interface Input {
    query: string;
    dataset: string;
    modelName: string;
    debug?: boolean;
}

export const inputSchema = z.object({
    query: z.string(),
    dataset: z.string(),
    modelName: z.enum([
        "google/gemini-2.5-flash",
        "google/gemini-2.0-flash-001",
        "openai/gpt-4.1",
        "openai/gpt-4.1-mini",
    ]),
    debug: z.boolean().default(false),
});

export async function handleInput(): Promise<Input> {
    let input = await Actor.getInput();

    // Used to pass input in local Docker developement setup
    if (!input) input = JSON.parse(process.env.ACTOR_INPUT ?? "");
    return inputSchema.parse(input) as Input;
}
