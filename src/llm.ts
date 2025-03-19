import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function queryLLM(input: {
    query: string;
    instructions?: string;
    model?: string;
}): Promise<string> {
    const {
        query,
        instructions = 'You are a helpful assistant',
        model = 'gpt-4o-mini',
    } = input;
    const response = await client.responses.create({
        model: model,
        instructions: instructions,
        input: query,
    });
    return response.output_text;
}
