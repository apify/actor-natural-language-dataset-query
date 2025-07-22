import { Actor, log, LogLevel } from 'apify';
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
import { queryLLMGetReport, queryLLMGetSQL, queryLLMImportantFields, queryLLMIsQuerySane } from './llm';
import { getActorContext } from './actors';

async function main() {
    await Actor.init();

    const input = await handleInput();
    if (!input) {
        log.error('Input is invalid');
        await Actor.exit({ statusMessage: 'Input is invalid' });
        return;
    }
    const model = input.modelName;
    if (input.debug) log.setLevel(LogLevel.DEBUG);

    log.info('getting dataset...');
    const dataset = (await getApifyDataset(input.dataset)) as { actId: string };
    const datasetItems = await getApifyDatasetItems(input.dataset);

    log.info('infering dataset shape...');
    const typeShape = getDatasetTypeShape(datasetItems);
    const tableShape = convertTypeShapeToTableShape(typeShape);
    log.debug(`Table shape: ${JSON.stringify(tableShape)}`);

    log.info('preparing database engine...');
    const db = createDatabase();
    initializeDatabase(db, TABLE_NAME, tableShape);
    populateDatabase(db, TABLE_NAME, tableShape, datasetItems);

    const actorContext = await getActorContext(dataset.actId);

    const { isSane: isQuerySane, reason: saneReason } =
        await queryLLMIsQuerySane({
            prompt: input.query,
            tableShape,
            actorContext,
            model,
        });
    if (!isQuerySane) {
        log.error(`User query is not sane: ${saneReason} I am quitting...`);
        await Actor.exit({ statusMessage: 'User query is not sane' });
        return;
    }

    const importantFields = await queryLLMImportantFields({
        prompt: input.query,
        tableShape,
        actorContext,
        model,
    });
    const additionalSQLContext = `Possible important table fields:\n ${importantFields.map(([field, reason]) => `${field}: ${reason}`).join('\n')}`;
    log.debug(`Important fields: ${JSON.stringify(importantFields)}`);

    const sql = await queryLLMGetSQL({
        prompt: input.query,
        tableShape,
        actorContext,
        additionalContext: additionalSQLContext,
        model,
    });
    log.debug(`Generated SQL: ${sql}`);

    const userQuery = db.query(sql);
    const userQueryResult = userQuery.all();
    for (const row of userQueryResult) {
        log.debug(`Row: ${JSON.stringify(row)}`);
    }

    const response = await queryLLMGetReport({
        prompt: input.query,
        querySQL: sql,
        userQueryResult: JSON.stringify(userQueryResult),
        actorContext,
        model,
    });
    log.info(`Response: ${JSON.stringify(response)}`);

    await Actor.pushData({
        query: input.query,
        sql,
        response,
        dataset: input.dataset,
    });

    //await Actor.exit();
    process.exit(0);
}

await main();
