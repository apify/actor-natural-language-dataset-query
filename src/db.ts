import { Database } from 'bun:sqlite';

export function createDatabase() {
    return new Database(':memory:');
}
