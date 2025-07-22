import { ApifyClient } from 'apify';
import { getObjectKeyPath, isNumberFloat } from './utils';
import type { DatasetItem, TypeShape, ValueType } from './types';

export async function getApifyDataset(id: string): Promise<unknown> {
    const apifyClient = new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });

    return await apifyClient.dataset(id).get();
}

export async function getApifyDatasetItems(id: string): Promise<DatasetItem[]> {
    const apifyClient = new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });

    const datasetClient = apifyClient.dataset(id);

    const items = (await datasetClient.listItems()).items;
    return items;
}

/**
 * Resolves the most specific type from a set of type candidates.
 *
 * @param types - A set of type candidates.
 * @returns The most specific type as a string.
 */
export function resolveTypeCandidate(types: Set<string>): ValueType {
    const filteredTypes = Array.from(types).filter(
        (type) => type !== 'unknown',
    );

    if (filteredTypes.length === 1) {
        return filteredTypes[0] as ValueType;
    }

    return 'unknown';
}

/**
 * Determines the type of a given value.
 *
 * @param value - The value whose type is to be determined.
 * @returns The type of the value as a string.
 */
function getValueType(value: unknown): ValueType {
    if (Array.isArray(value)) {
        return 'array';
    }
    if (!value) {
        return 'unknown';
    }
    const type = typeof value;
    if (type === 'string' || type === 'boolean' || type === 'object') {
        return type;
    }
    if (type === 'number') {
        return isNumberFloat(value) ? 'float' : 'integer';
    }
    return 'unknown';
}

export function getDatasetTypeShape(
    obj: DatasetItem[],
    rootKey = '',
): TypeShape {
    const typeShape: TypeShape = {};
    const typeCandidates: Record<string, Set<string>> = {};

    // Collect all possible types for each key
    for (const item of obj) {
        const itemObj = getObjectKeyPath(item, rootKey);
        // If object is empty or undefined, skip it
        if (!itemObj) continue;
        for (const [key, value] of Object.entries(
            itemObj as Record<string, unknown>,
        )) {
            if (!typeCandidates[key]) {
                typeCandidates[key] = new Set();
            }

            const valueType = getValueType(value);
            typeCandidates[key].add(valueType);
        }
    }

    // Infer the most specific type for each key
    for (const [key, types] of Object.entries(typeCandidates)) {
        typeShape[key] = resolveTypeCandidate(types);
    }

    // Handle objects recursively
    for (const [key, type] of Object.entries(typeShape)) {
        if (type === 'object') {
            const subPath = rootKey ? `${rootKey}.${key}` : key;
            typeShape[key] = getDatasetTypeShape(obj, subPath);
        }
    }

    return typeShape;
}
