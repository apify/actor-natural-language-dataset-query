import { VALUE_TYPES_TO_SKIP } from "./const";
import type {
    DatasetItem,
    SqliteType,
    TableShape,
    TypeShape,
    ValueType,
} from "./types";
import { flattenObject, getObjectKeyPath } from "./utils";
import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Input } from "./input";
import {
    getApifyDataset,
    getApifyDatasetItems,
    getDatasetTypeShape,
} from "./dataset";
import { createDatabase } from "./db";
import { TABLE_NAME } from "./const";
import {
    queryLLMGetReport,
    queryLLMGetSQL,
    queryLLMImportantFields,
    queryLLMIsQuerySane,
} from "./llm";
import { getActorContext } from "./actors";
import { Actor, log } from "apify";

function convertValuePrimitiveTypeToSQLiteType(
    valueType: ValueType,
): SqliteType {
    switch (valueType) {
        case "string":
            return "TEXT";
        case "integer":
            return "INTEGER";
        case "float":
            return "REAL";
        case "boolean":
            return "INTEGER";
        default:
            return "TEXT";
    }
}

export function convertTypeShapeToTableShape(typeShape: TypeShape): TableShape {
    const tableShape: TableShape = {};
    const typeShapeFlatten = flattenObject(
        typeShape as Record<string, unknown>,
    );

    for (const [key, type] of Object.entries(typeShapeFlatten)) {
        if (VALUE_TYPES_TO_SKIP.includes(type as ValueType)) {
            continue;
        }

        tableShape[key] = convertValuePrimitiveTypeToSQLiteType(
            type as ValueType,
        );
    }

    return tableShape;
}

export function getSQLSchemaFromTableShape(
    tableName: string,
    tableShape: TableShape,
): string {
    const columns = Object.entries(tableShape)
        .map(([columnName, columnType]) => `'${columnName}' ${columnType}`)
        .join(", ");

    return `CREATE TABLE ${tableName} (${columns});`;
}

export function initializeDatabase(
    db: Database,
    tableName: string,
    tableShape: TableShape,
): void {
    const sql = getSQLSchemaFromTableShape(tableName, tableShape);
    const query = db.query(sql);
    query.run();
}

export function populateDatabase(
    db: Database,
    tableName: string,
    tableShape: TableShape,
    dataset: DatasetItem[],
) {
    const columns = Object.keys(tableShape)
        .map((col) => `'${col}'`)
        .join(", ");
    const placeholders = Object.keys(tableShape)
        .map(() => "?")
        .join(", ");

    const query = db.query(
        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
    );

    for (const item of dataset) {
        const values = Object.keys(tableShape).map((key) =>
            getObjectKeyPath(item, key),
        );
        query.run(...(values as SQLQueryBindings[]));
    }
}

export async function runQuery(input: Input): Promise<string | null> {
    const model = input.modelName;

    log.info("getting dataset...");
    const dataset = (await getApifyDataset(input.dataset)) as { actId: string };
    const datasetItems = await getApifyDatasetItems(input.dataset);

    log.info("infering dataset shape...");
    const typeShape = getDatasetTypeShape(datasetItems);
    const tableShape = convertTypeShapeToTableShape(typeShape);
    log.debug(`Table shape: ${JSON.stringify(tableShape)}`);

    log.info("preparing database engine...");
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
        log.warning(`User query is not sane: ${saneReason}`);
        return null;
    }

    const importantFields = await queryLLMImportantFields({
        prompt: input.query,
        tableShape,
        actorContext,
        model,
    });
    const additionalSQLContext = `Possible important table fields:\n ${importantFields.map(([field, reason]) => `${field}: ${reason}`).join("\n")}`;
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
    log.info("Data pushed to Apify dataset");

    return response;
}
