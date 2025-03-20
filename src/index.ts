import { Actor, log } from 'apify';
import { Database } from 'bun:sqlite';
import { handleInput } from './input';
import {
    getApifyDataset,
    getApifyDatasetItems,
    getDatasetTypeShape,
} from './dataset';
import { createDatabase } from './db';
import {
    convertTypeShapeToTableShape,
    initializeDatabase,
    populateDatabase,
} from './engine';
import { TABLE_NAME } from './const';
import {
    queryLLM,
    queryLLMGetReport,
    queryLLMGetSQL,
    queryLLMIsQuerySane,
} from './llm';
import { getActorContext } from './actors';

async function main() {
    await Actor.init();

    const input = await handleInput();
    if (!input) {
        log.error('Input is invalid');
        await Actor.exit({ statusMessage: 'Input is invalid' });
        return;
    }

    log.info('getting dataset...');
    const dataset = (await getApifyDataset(input.dataset)) as { actId: string };
    const datasetItems = await getApifyDatasetItems(input.dataset);

    log.info('infering dataset shape...');
    const typeShape = getDatasetTypeShape(datasetItems);
    const tableShape = convertTypeShapeToTableShape(typeShape);
    console.log(tableShape);

    log.info('preparing database engine...');
    const db = createDatabase();
    initializeDatabase(db, TABLE_NAME, tableShape);
    populateDatabase(db, TABLE_NAME, tableShape, datasetItems);

    const actorContext = await getActorContext(dataset.actId);

    const { isSane: isQuerySane, reason: saneReason } =
        await queryLLMIsQuerySane(input.query, tableShape, actorContext);
    if (!isQuerySane) {
        log.error(`User query is not sane: ${saneReason} I am quitting...`);
        await Actor.exit({ statusMessage: 'User query is not sane' });
        return;
    }

    const sql = await queryLLMGetSQL(input.query, tableShape, actorContext);
    console.log(sql);

    const userQuery = db.query(sql);
    const userQueryResult = userQuery.all();
    for (const row of userQueryResult) {
        console.log(row);
    }

    const response = await queryLLMGetReport(
        input.query,
        userQueryResult,
        actorContext,
    );
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
