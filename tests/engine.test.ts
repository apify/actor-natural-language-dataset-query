import { expect, test } from "bun:test";
import type {
    DatasetItem,
    SqliteType,
    TableShape,
    TypeShape,
} from "../src/types";
import {
    convertTypeShapeToTableShape,
    createDatabase,
    getSQLSchemaFromTableShape,
    initializeDatabase,
    populateDatabase,
} from "../src/engine";
import { getDatasetTypeShape } from "../src/dataset";

test("convert type shape to table shape", () => {
    const typeShape: TypeShape = {
        level1: {
            level2: {
                level3: "string",
                integerProp: "integer",
                floatProp: "float",
            },
            stringProp: "string",
        },
        topLevelProp: "boolean",
        arrayProp: "array",
    };

    const expected: Record<string, SqliteType> = {
        "level1.level2.level3": "TEXT",
        "level1.level2.integerProp": "INTEGER",
        "level1.level2.floatProp": "REAL",
        "level1.stringProp": "TEXT",
        topLevelProp: "INTEGER",
    };

    const result = convertTypeShapeToTableShape(typeShape);
    expect(result).toEqual(expected);
});

test("sql schema from table shape", () => {
    const tableName = "test_table";
    const tableShape: TableShape = {
        "level1.level2.level3": "TEXT",
        "level1.level2.integerProp": "INTEGER",
        "level1.level2.floatProp": "REAL",
        "level1.stringProp": "TEXT",
        topLevelProp: "INTEGER",
    };
    const expected = `CREATE TABLE ${tableName} ('level1.level2.level3' TEXT, 'level1.level2.integerProp' INTEGER, 'level1.level2.floatProp' REAL, 'level1.stringProp' TEXT, 'topLevelProp' INTEGER);`;
    expect(getSQLSchemaFromTableShape(tableName, tableShape)).toEqual(expected);
});

test("init database, insert and fetch", () => {
    const tableShape: TableShape = {
        "level1.level2.level3": "TEXT",
        "level1.level2.integerProp": "INTEGER",
        "level1.stringProp": "TEXT",
        topLevelProp: "INTEGER",
    };

    const db = createDatabase();
    initializeDatabase(db, "dataset", tableShape);

    // insert
    const query = db.query(
        'INSERT INTO dataset ("level1.level2.level3", "level1.level2.integerProp", "level1.stringProp", "topLevelProp") VALUES (?, ?, ?, ?)',
    );
    query.run("hello", 42, "test", 1);

    // fetch
    const stmt = db.prepare("SELECT * FROM dataset");
    const result = stmt.all();
    expect(result).toEqual([
        {
            "level1.level2.level3": "hello",
            "level1.level2.integerProp": 42,
            "level1.stringProp": "test",
            topLevelProp: 1,
        },
    ]);

    db.close();
});

test("init database, populate with dataset", () => {
    const dataset: DatasetItem[] = [
        {
            status: 200,
            response: "ok",
            metadata: {
                id: 1,
            },
        },
        {
            status: 404,
            response: "not found",
            metadata: {
                id: 2,
            },
        },
        {
            status: 500,
            response: "server error",
            metadata: {
                id: 3,
            },
        },
    ];
    const expected = [
        {
            status: 200,
            response: "ok",
            "metadata.id": 1,
        },
        {
            status: 404,
            response: "not found",
            "metadata.id": 2,
        },
        {
            status: 500,
            response: "server error",
            "metadata.id": 3,
        },
    ];
    const tableName = "dataset";

    // prepare type shape
    const typeShape = getDatasetTypeShape(dataset);
    const tableShape = convertTypeShapeToTableShape(typeShape);

    // prepare database
    const db = createDatabase();
    initializeDatabase(db, tableName, tableShape);
    populateDatabase(db, tableName, tableShape, dataset);

    // fetch
    const stmt = db.prepare(`SELECT * FROM ${tableName}`);
    const result = stmt.all();
    expect(result).toEqual(expected);
});
