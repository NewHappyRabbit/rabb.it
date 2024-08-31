import { afterAll, describe, expect, test } from 'vitest'
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { CategoryController } from '../routes/controllers/categories'
import { Category } from '../models/category';
import { mongoConfig } from '../config/database'
import 'dotenv/config';
import { setEnvVariables } from './common';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await Category.deleteMany({});
    categories = [];
})

let categories = [];
let imgPath;
describe('POST /categories', async () => {
    describe('Create category', async () => {
        const data = {
            name: 'Тест',
            order: 0
        };

        const result = await CategoryController.post({ data });
        test('Status is 201', () => {
            expect(result.status).toBe(201);
        });
        const category = result.category;

        test('Name is correct', () => {
            expect(category.name).toEqual(data.name);
        });

        test('Order is correct', () => {
            expect(category.order).toEqual(data.order);
        });

        test('Slug is correct', () => {
            expect(category.slug).toEqual("test");
        });
        test('Path is empty', () => {
            expect(category.path).toBe(null);
        });
        categories.push(category);
    });

    describe('Create sub-category', async () => {
        const data = {
            name: 'Тест 2',
            order: 5,
            parent: categories[0]._id
        };

        const result = await CategoryController.post({ data });
        const category = result.category;
        categories.push(category);

        test('Name is correct', () => {
            expect(category.name).toEqual("Тест 2");
        });

        test('Order is correct', () => {
            expect(category.order).toEqual(5);
        });

        test('Slug is correct', () => {
            expect(category.slug).toEqual("test-2");
        });

        test('Path is correct', () => {
            expect(category.path).toEqual(`,test,`);
        });
    });

    describe('Create sub-category', async () => {
        const data = {
            name: 'Дрехи',
            order: 0,
            parent: categories[0]._id
        };

        const result = await CategoryController.post({ data });
        const category = result.category;
        categories.push(category);

        test('Name is correct', () => {
            expect(category.name).toEqual(data.name);
        });

        test('Order is correct', () => {
            expect(category.order).toEqual(data.order);
        });

        test('Slug is correct', () => {
            expect(category.slug).toEqual("drehi");
        });

        test('Path is correct', () => {
            expect(category.path).toEqual(`,test,`);
        });
    });

    describe('Create sub-sub-category with image and duplicate slug', async () => {
        const data = {
            name: 'Тест 2', // dont change
            order: 0,
            parent: categories[1]._id,
        };

        // Fake uploaded img from form
        const img = { buffer: fs.readFileSync(path.join(dirname(fileURLToPath(import.meta.url)), 'testimg.png')) };

        const result = await CategoryController.post({ data, img });
        const category = result.category;
        categories.push(category);
        const imgExists = fs.existsSync(category.image.path)
        imgPath = category.image.path;


        test('Name is correct', () => {
            expect(category.name).toEqual(data.name);
        });

        test('Order is correct', () => {
            expect(category.order).toEqual(data.order);
        });

        test('Duplicate slug is correct', () => {
            expect(category.slug).toEqual("test-2-1");
        });

        test('Path is correct', () => {
            expect(category.path).toEqual(`,test,test-2,`);
        });

        test('Image uploaded and saved', () => {
            expect(category.image).toBeTypeOf('object');
            expect(imgExists).toEqual(true); // saved to public/images/ folder
        });
    });

});

describe('GET /categories', async () => {
    const data = await CategoryController.get();

    test('Categories count is correct', () => {
        expect(data.length).toEqual(categories.length)
    });
});

describe('PUT /categories/:id', async () => {
    describe('Update category', async () => {
        const data = {
            name: 'Тениски',
            order: 0,
        };

        const result = await CategoryController.put({ id: categories[3]._id, data });
        const category = result.category;

        test('Name is correct', () => {
            expect(category.name).toEqual(data.name);
        });

        test('Order is correct', () => {
            expect(category.order).toEqual(data.order);
        });

        test('Slug is correct', () => {
            expect(category.slug).toEqual("teniski");
        });

        test('Path is correct', () => {
            expect(category.path).toEqual(`,test,test-2,`);
        });

        test('Image was not deleted', () => {
            expect(category.image.path).toEqual(imgPath);
        });
    });
});

describe('DELETE /categories/:id', async () => {
    const result = await CategoryController.delete({ id: categories[3]._id });

    test('Category was deleted', () => {
        expect(result.status).toEqual(204);
    });

    test('Image was deleted', () => {
        expect(fs.existsSync(categories[3].image.path)).toEqual(false);
    });
});

await Category.deleteMany({})