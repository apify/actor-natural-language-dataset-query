import { VALUE_TYPES_TO_SKIP } from './const';
import type {
    DatasetItem,
    SqliteType,
    TableShape,
    TypeShape,
    ValueType,
} from './types';
import { flattenObject, getObjectKeyPath } from './utils';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

function convertValuePrimitiveTypeToSQLiteType(
    valueType: ValueType,
): SqliteType {
    switch (valueType) {
        case 'string':
            return 'TEXT';
        case 'integer':
            return 'INTEGER';
        case 'float':
            return 'REAL';
        case 'boolean':
            return 'INTEGER';
        default:
            return 'TEXT';
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
        .join(', ');

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
        .join(', ');
    const placeholders = Object.keys(tableShape)
        .map(() => '?')
        .join(', ');

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
