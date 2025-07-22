import { test, expect } from "bun:test";
import { getDatasetTypeShape } from "../src/dataset";
import type { DatasetItem, TypeShape } from "../src/types";

test("type shape basic", () => {
    const input: DatasetItem[] = [
        {
            level1: {
                level2: {
                    level3: "hello",
                    integerProp: 42,
                    floatProp: 42.5,
                },
                stringProp: "test",
            },
            topLevelProp: true,
        },
    ];

    const expected: TypeShape = {
        level1: {
            level2: {
                level3: "string",
                integerProp: "integer",
                floatProp: "float",
            },
            stringProp: "string",
        },
        topLevelProp: "boolean",
    };

    const result = getDatasetTypeShape(input, "");
    expect(JSON.stringify(result)).toEqual(JSON.stringify(expected));
});

test("type shape prop with null value", () => {
    const input: DatasetItem[] = [
        {
            prop: null,
        },
        {
            prop: 123,
        },
        {
            prop: 123,
        },
    ];

    const expected: TypeShape = {
        prop: "integer",
    };

    const result = getDatasetTypeShape(input, "");
    expect(JSON.stringify(result)).toEqual(JSON.stringify(expected));
});

test("type shape with array type", () => {
    const input: DatasetItem[] = [
        {
            arrayProp: [],
        },
        {
            arrayProp: [4, 5, 6],
        },
    ];

    const expected: TypeShape = {
        arrayProp: "array",
    };

    const result = getDatasetTypeShape(input, "");
    expect(JSON.stringify(result)).toEqual(JSON.stringify(expected));
});
