import 'dotenv/config';
import { afterAll, describe, expect, test } from 'vitest'
import { mongoConfig } from '../config/database.js'
import { setEnvVariables } from './common.js';
import { Product } from '../models/product.js';
import { ProductController } from '../controllers/products.js';
import { Category } from '../models/category.js';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await Product.deleteMany({});
});

describe('POST /products', async () => {
    const category = await new Category({
        name: "Test",
        slug: "test",
    }).save();

    test('Create simple product', async () => {
        const data = {
            name: "Test",
            code: "123",
            barcode: "1234567890123",
            description: "Test",
            quantity: 10,
            category: category._id,
            deliveryPrice: 10,
            wholesalePrice: 11,
            retailPrice: 12,
            unitOfMeasure: "Test",
        };

        const { status, product } = await ProductController.post({ data });
        expect(status).toBe(201);
        expect(product.name).toEqual(data.name);
        expect(product.code).toEqual(data.code);
        expect(product.barcode).toEqual(data.barcode);
        expect(product.description).toEqual(data.description);
        expect(product.quantity).toEqual(data.quantity);
        expect(product.category).toEqual(data.category);
        expect(product.deliveryPrice).toEqual(data.deliveryPrice);
        expect(product.wholesalePrice).toEqual(data.wholesalePrice);
        expect(product.retailPrice).toEqual(data.retailPrice);
        expect(product.unitOfMeasure).toEqual(data.unitOfMeasure);
    });

    test("Create variable product + code and barcode auto generated", async () => {
        const data = {
            name: "Test2",
            description: "Test2",
            quantity: 10,
            category: category._id,
            deliveryPrice: 10,
            wholesalePrice: 11,
            retailPrice: 12,
            unitOfMeasure: "Test",
            sizes: JSON.stringify([
                {
                    size: "S",
                    quantity: 10,
                },
                {
                    size: "M",
                    quantity: 10,
                },
                {
                    size: "L",
                    quantity: 10,
                },
            ])
        };

        const { status, product } = await ProductController.post({ data });
        expect(status).toBe(201);
        expect(product.code.length).toBeGreaterThan(0);
        expect(product.barcode.length).toBe(13);
        expect(product.sizes.length).toEqual(data.sizes.length);
    });

    // TODO Add tests for default unit of measure

    describe('Validation', async () => {
        test('Name', async () => {
            const data = {
            };

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('name');
        });

        test('Quantity', async () => {
            const data = {
                name: 'asd',
            }

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('quantity');
        });

        test('Delivery price', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
            }

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('deliveryPrice');
        });

        test('Wholesale price', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 10,
            }

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('wholesalePrice');
        });

        test('Retail price', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 10,
                wholesalePrice: 10,
            }

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('retailPrice');
        });

        describe('Price regex', () => {
            test('NaN', async () => {
                const data = {
                    name: 'asd',
                    quantity: 10,
                    deliveryPrice: 'asd',
                    wholesalePrice: '123',
                    retailPrice: '123',
                };

                const { status, property } = await ProductController.post({ data });
                expect(status).toBe(400);
                expect(property).toEqual('deliveryPrice');
            });

            test('X.XXX', async () => {
                const data = {
                    name: 'asd',
                    quantity: 10,
                    deliveryPrice: 10.155,
                    wholesalePrice: '123',
                    retailPrice: '123',
                };

                const { status, property } = await ProductController.post({ data });
                expect(status).toBe(400);
                expect(property).toEqual('deliveryPrice');
            });
        });

        test('Wholesale < delivery', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 10,
                wholesalePrice: 9,
                retailPrice: 11,
            };

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('wholesalePrice');
        });

        test('Retail < delivery (simple product)', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 10,
                wholesalePrice: 11,
                retailPrice: 10,
            };

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('retailPrice');
        });

        test('Retail < delivery (variable product)', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 20,
                wholesalePrice: 21,
                retailPrice: 5,
                sizes: JSON.stringify([
                    {
                        size: "S",
                        quantity: 10,
                    },
                    {
                        size: "M",
                        quantity: 10,
                    },
                ])
            };

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('retailPrice');
        });

        test('Sizes', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 20,
                wholesalePrice: 21,
                retailPrice: 30,
                sizes: JSON.stringify([
                    {
                        size: "S",
                    },
                    {
                        size: "M",
                        quantity: 10,
                    },
                ])
            };

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('sizes');
        });

        test('Category', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 10,
                wholesalePrice: 11,
                retailPrice: 12,
            }

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('category');
        });

        test('Category doesnt exists', async () => {
            const data = {
                name: 'asd',
                quantity: 10,
                deliveryPrice: 10,
                wholesalePrice: 11,
                retailPrice: 12,
                category: '665f18f6377386e5a8f33c4a',
            }

            const { status, property } = await ProductController.post({ data });
            expect(status).toBe(400);
            expect(property).toEqual('category');
        });
    });
});