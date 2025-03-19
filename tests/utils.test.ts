import { test, expect } from 'bun:test';
import { flattenObject, getObjectKeyPath, isNumberFloat } from '../src/utils';
import { setObjectKeyPath } from '../src/utils';

test('getObjectKeyPath should return the value at the specified key path', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    expect(getObjectKeyPath(obj, 'a.b.c')).toBe(42);
});

test('getObjectKeyPath should return null if the key path does not exist', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    expect(getObjectKeyPath(obj, 'a.b.d')).toBeNull();
});

test('getObjectKeyPath should return null if the key path is partially invalid', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    expect(getObjectKeyPath(obj, 'a.x.c')).toBeNull();
});

test('getObjectKeyPath should handle empty key path', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    expect(getObjectKeyPath(obj, '')).toBe(obj);
});

test('getObjectKeyPath should handle non-object values in the path', () => {
    const obj = {
        a: {
            b: 42,
        },
    };
    expect(getObjectKeyPath(obj, 'a.b.c')).toBeNull();
});

test('setObjectKeyPath should set the value at the specified key path', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    const result = setObjectKeyPath(obj, 'a.b.c', 100);
    expect(getObjectKeyPath(result, 'a.b.c')).toBe(100);
});

test('setObjectKeyPath should create nested objects if the key path does not exist', () => {
    const obj = {};
    setObjectKeyPath(obj, 'a.b.c', 42);
    expect(getObjectKeyPath(obj, 'a.b.c')).toBe(42);
});

test('setObjectKeyPath should overwrite existing values', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    const result = setObjectKeyPath(obj, 'a.b', { d: 100 });
    expect(getObjectKeyPath(result, 'a.b')).toEqual({ d: 100 });
    expect(getObjectKeyPath(result, 'a.b.c')).toBeNull();
});

test('setObjectKeyPath should handle empty key path', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    const result = setObjectKeyPath(obj, '', { x: 100 });
    expect(result).toEqual({ x: 100 });
});

test('setObjectKeyPath should handle non-object values in the path', () => {
    const obj = {
        a: {
            b: 42,
        },
    };
    const result = setObjectKeyPath(obj, 'a.b.c', 100);
    expect(getObjectKeyPath(result, 'a.b')).toEqual({ c: 100 });
});

test('should keep existing values when setting a nested key', () => {
    const obj = {
        a: {
            b: 42,
        },
    };
    const result = setObjectKeyPath(obj, 'a.c', 100);
    expect(getObjectKeyPath(result, 'a.b')).toBe(42);
    expect(getObjectKeyPath(result, 'a.c')).toBe(100);
});

test('flatten object', () => {
    const obj = {
        a: {
            b: {
                c: 42,
            },
        },
    };
    const result = flattenObject(obj);
    expect(result).toEqual({ 'a.b.c': 42 });
});

test('is number float', () => {
    expect(isNumberFloat(42)).toBe(false);
    expect(isNumberFloat(42.5)).toBe(true);
    expect(isNumberFloat('42')).toBe(false);
    expect(isNumberFloat('42.5')).toBe(false);
    expect(isNumberFloat('42.5.5')).toBe(false);
});
