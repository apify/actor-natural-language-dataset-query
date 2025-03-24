import OpenAI from 'openai';
import type { ActorContext, QueryLLMResponse, TableShape } from './types';
import { TABLE_NAME } from './const';
import { log } from 'apify';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function queryLLM(input: {
    query: string;
    instructions?: string;
    model?: string;
}): Promise<QueryLLMResponse> {
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
    log.info(`Input tokens used: ${response.usage?.input_tokens || 0}`);
    log.info(`Output tokens used: ${response.usage?.output_tokens || 0}`);
    return {
        text: response.output_text,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
    };
}

/**
 * Queries the LLM to identify important fields from a table schema relevant to a user query.
 *
 * @param {string} prompt - The user query for which important fields need to be identified.
 * @param {TableShape} tableShape - The schema of the table to be analyzed.
 * @param {ActorContext} actorContext - The context of the actor including name and description.
 * @returns {Promise<Record<string, string>>} - A promise that resolves to a record where each key is a field name and the value is a short reason for its importance.
 */
export async function queryLLMImportantFields(
    prompt: string,
    tableShape: TableShape,
    actorContext: ActorContext,
): Promise<[string, string][]> {
    const { text: response } = await queryLLM({
        instructions: 'You are an expert data analyst. Given a user query, provide a list of possible important fields from the table schema that may be relevant to the query. For each field, provide a short reason in a single short sentence. STRICTLY ADHERE TO THIS OUTPUT FORMAT: EACH LINE SHOULD CONTAIN A FIELD NAME FOLLOWED BY A SHORT REASON SEPARATED BY A COLON. USE RAW STRINGS WITHOUT ANY FORMATTING LIKE MARKDOWN.',
        query: `Identify important fields for the following user query: ${prompt}
        Table schema: ${JSON.stringify(tableShape)}
        Actor name: ${actorContext.name}
        Actor description: ${actorContext.description}`,
    });

    const lines = response.split('\n');
    const result: [string, string][] = [];

    for (const line of lines) {
        const [field, reason] = line.split(':').map(part => part.trim());
        if (field && reason) {
            result.push([field, reason]);
        }
    }

    return result;
}

export async function queryLLMIsQuerySane(
    prompt: string,
    tableShape: TableShape,
    actorContext: ActorContext,
): Promise<{
    isSane: boolean;
    reason: string;
}> {
    const { text: response } = await queryLLM({
        instructions: `You are an expert data analyst. Determine if the provided user query makes sense given the table schema and actor context. Respond with 'yes' if the query is sane and 'no' if it is not. For example, if the table schema is related to an e-commerce site and the user wants to show the total number of Instagram posts, the query is not sane: so output 'no'. STRICTLY ADHERE TO THIS OUTPUT FORMAT: ONLY OUTPUT 'yes' or 'no' ON THE FIRST LINE AND ON THE SECOND LINE A REASON WHICH IS A SINGLE SHORT SENTENCE. IF THE OUTPUT IS 'yes' THEN THE REASON MUST BE n/a. IF THE OUTPUT IS 'no' THE SECOND LINE MUST BE A REAL REASON. USE RAW STRINGS WITHOUT ANY FORMATTING LIKE MARKDOWN.`,
        query: `Is the following user query sane: ${prompt}
        Table schema: ${JSON.stringify(tableShape)}
        Actor name: ${actorContext.name}
        Actor description: ${actorContext.description}`,
    });

    const lines = response.split('\n');
    if (lines.length !== 2) {
        throw new Error('Invalid response from LLM');
    }

    return {
        isSane: lines[0]?.trim().toLowerCase() === 'yes',
        reason: lines[1]?.trim() || '',
    };
}

export async function queryLLMGetSQL(
    prompt: string,
    tableShape: TableShape,
    actorContext: ActorContext,
    additionalContext = '',
) {
    const { text } = await queryLLM({
        instructions:
            'You are a SQLite3-only expert data analyst providing helpful and functional database queries. Always follow best querying practices like wrapping column names in double quotes, and table names in single quotes and aliasing where it makes sense like COUNT(*), which should always be aliased to be readable. RETURN ONLY THE RAW SQL QUERY STRING WITHOUT ANY MARKDOWN JUST RAW TEXT NOTHING ELSE.',
        query: `Provide SQL query for the following user prompt: ${prompt}
        Table name: ${TABLE_NAME}
        Table schema: ${JSON.stringify(tableShape)}
        Output in the database is from this Apify Actor.
        Actor name: ${actorContext.name}
        Actor description: ${actorContext.description}
        ${additionalContext ? `Additional context: ${additionalContext}` : ''}`,
    });
    return text;
}

export async function queryLLMGetReport(
    prompt: string,
    querySQL: string,
    userQueryResult: string,
    actorContext: ActorContext,
) {
    const { text } = await queryLLM({
        instructions: `You are an expert report writer for data analysis results. You are given a query from your boss, data results from an expert analyst, and write a report to answer the boss's query. Keep it simple and to the point. Your boss is technical and does not like bluffing or boilerplate. Keep it raw and simple. Do not use markdown unless tasked otherwise and keep it as a simple response to the query. For example, for the query "What is the number of failed user logins in the last month" respond "The total number of failed user logins in the last month is 3" unless asked otherwise.`,
        query: `Write a report to answer the following query:
        ${prompt}
        Reply in the context of this Apify Actor, data are from this Actor run.
        Actor name: ${actorContext.name}
        Actor description: ${actorContext.description}
        ---
        Here is the SQL query that was executed: ${querySQL}
        Here are the results of the query:
        ${userQueryResult}`,
    });
    return text;
}
