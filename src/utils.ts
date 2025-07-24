/**
 * Retrieves the value at a given key path from an object.
 *
 * @param obj - The object to retrieve the value from.
 * @param keyPath - The path of the key to retrieve, with keys separated by dots.
 * @returns The value at the specified key path, or null if the key path does not exist.
 */
export function getObjectKeyPath(
    obj: Record<string, unknown>,
    keyPath: string,
): unknown {
    if (!keyPath) {
        return obj;
    }

    const path = keyPath.split(".");

    let current = obj;
    for (const key of path) {
        if (!current[key]) {
            return null;
        }
        current = current[key] as Record<string, unknown>;
    }

    return current;
}

/**
 * Sets the value at a given key path in an object.
 *
 * @param obj - The object to set the value in.
 * @param keyPath - The path of the key to set, with keys separated by dots.
 * @param value - The value to set at the specified key path.
 * @returns The updated object.
 */
export function setObjectKeyPath(
    obj: Record<string, unknown>,
    keyPath: string,
    value: unknown,
): Record<string, unknown> {
    let current: Record<string, unknown> | undefined = obj;
    if (!keyPath) {
        current = value as Record<string, unknown>;
        return current;
    }

    const path = keyPath.split(".");

    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i] as string;
        if (!current[key] || typeof current[key] !== "object") {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }

    const lastKey = path[path.length - 1] as string;
    current[lastKey] = value;

    return obj;
}

/**
 * Flattens a nested object into a single level object with dot-separated keys.
 *
 * @param obj - The object to flatten.
 * @param prefix - The prefix for the keys (used for recursion).
 * @returns The flattened object.
 */
export function flattenObject(
    obj: Record<string, unknown>,
    prefix = "",
): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (
                typeof obj[key] === "object" &&
                obj[key] !== null &&
                !Array.isArray(obj[key])
            ) {
                Object.assign(
                    flattened,
                    flattenObject(obj[key] as Record<string, unknown>, newKey),
                );
            } else {
                flattened[newKey] = obj[key];
            }
        }
    }

    return flattened;
}

/**
 * Checks if a given value is a float.
 *
 * @param value - The value to check.
 * @returns True if the value is a float, false otherwise.
 */
export function isNumberFloat(value: unknown): boolean {
    return typeof value === "number" && !Number.isInteger(value);
}
