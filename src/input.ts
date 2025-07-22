import { Actor, log } from 'apify';

import { z } from 'zod';

interface Input {
    query: string;
    dataset: string;
    modelName: string;
    debug: boolean;
}

const inputSchema = z.object({
    query: z.string(),
    dataset: z.string(),
    modelName: z.string().default('openai/gpt-4.1'),
    debug: z.boolean().default(false),
});

export async function handleInput(): Promise<Input | null> {
    let input = await Actor.getInput();

    try {
        if (!input) input = JSON.parse(process.env.ACTOR_INPUT ?? '');
        const inputModel = inputSchema.parse(input);

        return inputModel as Input;
    } catch (e) {
        if (e instanceof SyntaxError) {
            log.error('Input JSON parse error', { error: e });
        } else if (e instanceof z.ZodError) {
            log.error('Input validation failed', { error: e });
        } else {
            log.error('Unknown error', { error: e });
        }
    }

    return null;
}
