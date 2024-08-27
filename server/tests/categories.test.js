import { describe, expect, test, vi } from 'vitest'
import { CategoryController } from '../routes/controllers/categories'
import { mongoConfig } from '../config/database'
import 'dotenv/config';
import { Category } from '../models/category';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

vi.stubEnv('ENV', 'test');
vi.stubEnv('MONGO_USER', process.env.MONGO_TEST_USER);
vi.stubEnv('MONGO_PASSWORD', process.env.MONGO_TEST_PASSWORD);

await mongoConfig();

describe('POST /categories', async () => {
    var firstCategoryId, secondCategoryId;
    describe('Create simple category', async () => {
        const data = {
            name: 'Тест',
            order: 0
        };

        const result = await CategoryController.createCategory({ data });
        test('status is 201', () => {
            expect(result.status).toBe(201);
        });
        const category = result.category;

        test('category is an object', () => {
            expect(category).toBeTypeOf('object');
        });

        test('category has name', () => {
            expect(category.name).toBeTypeOf('string');
        });

        test('category slug is correct', () => {
            expect(category.slug).toEqual("test");
        });
        test('category has no path', () => {
            expect(category.path).toBe(null);
        });
        firstCategoryId = category._id;
    });

    describe('Create sub-category', async () => {
        const data = {
            name: 'Тест',
            order: 0,
            parent: firstCategoryId
        };

        const result = await CategoryController.createCategory({ data });
        const category = result.category;
        secondCategoryId = category._id;

        test('duplicate category slug is correct', () => {
            expect(category.slug).toEqual("test-1");
        });

        test('category path is correct', () => {
            expect(category.path).toEqual(`,test,`);
        });
    });

    describe('Create sub-sub-category with image', async () => {
        const data = {
            name: 'Тест',
            order: 0,
            parent: secondCategoryId,
        };

        // Fake uploaded img from form
        const img = { buffer: fs.readFileSync(path.join(dirname(fileURLToPath(import.meta.url)), 'testimg.png')) };

        const result = await CategoryController.createCategory({ data, img });
        const category = result.category;

        test('duplicate category slug is correct', () => {
            expect(category.slug).toEqual("test-2");
        });

        test('category path is correct', () => {
            expect(category.path).toEqual(`,test,test-1,`);
        });

        test('image uploaded and saved', () => {
            expect(category.image.length).toBeGreaterThan(0);
            expect(fs.existsSync(category.image.path)).toEqual(true); // saved to public/images/ folder
        });
    });
})

test('GET /categories', async () => {
    const data = await CategoryController.getCategories()
    expect(data.length).toEqual(3)
})


await Category.deleteMany({})