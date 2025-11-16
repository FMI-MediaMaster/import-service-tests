import request from 'supertest';
import { describe, it, expect } from 'vitest';

type TypeMap = {
    number: number;
    string: string;
};

export type Fields = Record<string, { type: keyof TypeMap }>;

type FromSchema<T extends Fields> = {
    [K in keyof T]: T[K]['type'] extends keyof TypeMap ? TypeMap[T[K]['type']] : unknown;
};

const runEndpointTests = (
    server: any,
    endpoint: string,
    {
        validIds,
        nonExistentIds,
        invalidQueries,
        fields
    }: {
        validIds: string[];
        nonExistentIds: string[];
        invalidQueries: string[];
        fields: Fields;
    }
) => {
    type Item = FromSchema<typeof fields>;
    const fieldKeys = Object.keys(fields);
    const checkFields = (item: Item) => {
        expect(Object.keys(item)).toEqual(fieldKeys);

        for (const [key, props] of Object.entries(fields)) {
            expect(typeof item[key]).toBe(props['type']);
            if (!('empty' in props && props['empty'] === true)) {
                expect(item[key]).not.toBeNull();
            }
        }
    };

    describe('GET /import', async () => {
        validIds.forEach((id) => {
            it(`Query with valid id '${id}' gives proper results`, async () => {
                const { body, status } = await request(server).get(`${endpoint}?id=${encodeURIComponent(id)}`);
                expect(status).toBe(200);
                expect(Array.isArray(body)).toBe(true);
                expect(body.length).toBeGreaterThan(0);
                (body as Item[]).forEach((item) => checkFields(item));
            });
        });

        nonExistentIds.forEach((id) => {
            it(`Query with non-existent id '${id}' gives empty result`, async () => {
                const { body, status } = await request(server).get(`${endpoint}?id=${encodeURIComponent(id)}`);
                expect(status).toBe(200);
                expect(Array.isArray(body)).toBe(true);
                expect(body.length).toBe(0);
            });
        });

        it('Error when no query', async () => {
            const { body, status } = await request(server).get(`${endpoint}`);
            expect(status).toBe(400);
            expect(body).toHaveProperty('error');
            expect(body.error).toBe(`Missing parameter for the import endpoint`);
        });

        invalidQueries.forEach((query) => {
            it(`Error with query '${query}'`, async () => {
                const { body, status } = await request(server).get(`${endpoint}?${encodeURIComponent(query)}`);
                expect(status).toBe(400);
                expect(body).toHaveProperty('error');
                expect(body.error).toBe(`Missing parameter for the import endpoint`);
            });
        });
    });
};

const runImportTests = (
    server: any,
    endpoint: string,
    {
        validIds,
        invalidIds,
        fields,
    }: {
        validIds: string[];
        invalidIds: string[];
        fields: Fields;
    }
) => {
    const destroyQuery = (method: string, key: string, value: string) => ({
        split: `${key[0]} ${key.slice(1)}=${value}`,
        duplicate: `${key[0].repeat(2)}${key}=${value}`,
    }[method] ?? `${key}=${value}`);
    
    runEndpointTests(
        server,
        `${endpoint}/import`,
        {
            validIds,
            nonExistentIds: invalidIds,
            invalidQueries: ['split', 'duplicate'].map(m => destroyQuery(m, 'id', validIds[0])),
            fields,
        }
    );
};

export default runImportTests;