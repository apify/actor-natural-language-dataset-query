export type ValueType =
    | 'string'
    | 'integer'
    | 'float'
    | 'boolean'
    | 'object'
    | 'unknown'
    | 'array';

export type SqliteType = 'TEXT' | 'INTEGER' | 'REAL';

export type TypeShape = ValueType | { [key: string]: TypeShape };

export type DatasetItem = Record<string, unknown>;

export type TableShape = { [key: string]: SqliteType };
