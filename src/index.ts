import { Actor, log } from 'apify';
import { Database } from 'bun:sqlite';
import { handleInput } from './input';
import { getApifyDataset, getDatasetTypeShape } from './dataset';
import { createDatabase } from './db';
import {
    convertTypeShapeToTableShape,
    initializeDatabase,
    populateDatabase,
} from './engine';
import { TABLE_NAME } from './const';
import { queryLLM } from './llm';

async function main() {
    await Actor.init();

    const input = await handleInput();
    if (!input) {
        log.error('Input is invalid');
        await Actor.exit({ statusMessage: 'Input is invalid' });
        return;
    }

    log.info('getting dataset...');
    const dataset = await getApifyDataset(input.dataset);

    log.info('infering dataset shape...');
    const typeShape = getDatasetTypeShape(dataset);
    const tableShape = convertTypeShapeToTableShape(typeShape);
    console.log(tableShape);

    log.info('preparing database engine...');
    const db = createDatabase();
    initializeDatabase(db, TABLE_NAME, tableShape);
    populateDatabase(db, TABLE_NAME, tableShape, dataset);

    const query = db.query(`SELECT * FROM ${TABLE_NAME}`);
    for (const row of query.all()) {
        console.log(row);
    }

    const sql = await queryLLM({
        instructions:
            'You are a SQLite3-only expert data analyst providing helpful and functional database queries. Always follow best querying practices like wrapping column names in double quotes, and table names in single quotes and aliasing where it makes sense like COUNT(*), which should always be aliased to be readable. RETURN ONLY THE RAW SQL QUERY STRING WITHOUT ANY MARKDOWN JUST RAW TEXT NOTHING ELSE.',
        query: `Provide SQL query for the following user prompt: ${input.query}
        Table name: ${TABLE_NAME}
        Table schema: ${JSON.stringify(tableShape)}`,
    });
    console.log(sql);

    const userQuery = db.query(sql);
    const userQueryResult = userQuery.all();
    for (const row of userQueryResult) {
        console.log(row);
    }

    const response = await queryLLM({
        instructions: `You are an expert report writer for data analysis results. You are given a query from your boss, data results from an expert analyst, and write a report to answer the boss's query. Keep it simple and to the point. Your boss is technical and does not like bluffing or boilerplate. Keep it raw and simple. Do not use markdown unless tasked otherwise and keep it as a simple response to the query. For example, for the query "What is the number of failed user logins in the last month" respond "The total number of failed user logins in the last month is 3" unless asked otherwise.`,
        query: `Write a report to answer the following query:
        ${input.query}
        ---
        Data:
        ${JSON.stringify(userQueryResult)}`,
    });
    console.log(response);

    await Actor.pushData({
        query: input.query,
        sql,
        response,
        dataset: input.dataset,
    });

    await Actor.exit();
}

await main();
