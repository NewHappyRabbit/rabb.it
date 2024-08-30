import { afterAll, describe, expect, test } from 'vitest'
import { CategoryController } from '../routes/controllers/categories'
import { mongoConfig } from '../config/database'
import 'dotenv/config';
import { Category } from '../models/category';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { setEnvVariables } from './common';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await Category.deleteMany({});
})

const categories = [];
describe('POST /categories', async () => {
    describe('Create category', async () => {
        const data = {
            name: 'Тест',
            order: 0
        };

        const result = await CategoryController.createCategory({ data });
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

        const result = await CategoryController.createCategory({ data });
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

        const result = await CategoryController.createCategory({ data });
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

        const result = await CategoryController.createCategory({ data, img });
        const category = result.category;
        categories.push(category);

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
            expect(fs.existsSync(category.image.path)).toEqual(true); // saved to public/images/ folder
        });
    });

});

describe('GET /categories', async () => {
    const data = await CategoryController.getCategories();

    test('Categories count is correct', () => {
        expect(data.length).toEqual(categories.length)
    });

    describe('Categories data is correct', () => {
        for (let category of categories) {
            const categoryInData = data.find(c => c._id.toString() === category._id.toString());

            test('ID is correct', () => {
                expect(categoryInData._id.toString()).toEqual(category._id.toString());
            });

            test('Name is correct', () => {
                expect(categoryInData.name).toEqual(category.name);
            });

            test('Order is correct', () => {
                expect(categoryInData.order).toEqual(category.order);
            });

            test('Slug is correct', () => {
                expect(categoryInData.slug).toEqual(category.slug);
            });

            test('Image is correct', () => {
                expect(categoryInData.image).toEqual(category.image);
            });
        }

    });
});

describe('PUT /categories/:id', async () => {
    describe('Update category', async () => {
        const data = {
            name: 'Тениски',
            order: 0,
        };

        const result = await CategoryController.updateCategory({ id: categories[3]._id, data, lean: true });
        const category = result.category;

        test('Name is correct', () => {
            expect(category.name).toEqual(data.name);
        });

        test('Order is correct', () => {
            expect(category.order).toEqual(data.order);
        });

        test('Slug is correct', () => {
            expect(category.slug).toEqual("tenisksi");
        });

        test('Path is correct', () => {
            expect(category.path).toEqual(`,test,test-2,`);
        });

        if (category.image)
            test('Image was not deleted', () => {
                expect(category.image.path).toEqual(categories[3].image.path);
            })

    })

});


await Category.deleteMany({})