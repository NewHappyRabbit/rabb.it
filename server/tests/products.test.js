import 'dotenv/config';
import { afterAll, describe, expect, test } from 'vitest'
import { mongoConfig } from '../config/database.js'
import { setEnvVariables } from './common.js';
import { Product } from '../models/product.js';
import { ProductController } from '../controllers/products.js';
import { Category } from '../models/category.js';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Order } from '../models/order.js';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Order.deleteMany({});
});

const products = [];
describe('POST /products', async () => {
    const category = await new Category({
        name: "Test",
        slug: "test",
    }).save();

    test('Create simple product with image', async () => {
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

        // Fake uploaded img from form
        const image = [{ buffer: fs.readFileSync(path.join(dirname(fileURLToPath(import.meta.url)), 'testimg.png')) }];

        const { status, product } = await ProductController.post({ data, files: { image } });
        products.push(product);
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

        // Check image exists
        const imgExists = fs.existsSync(product.image.path)
        expect(product.image).toBeTypeOf('object');
        expect(imgExists).toEqual(true); // saved to public/images/ folder
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
        products.push(product);
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

describe('PUT /products/:id', async () => {
    const category = await new Category({
        name: "Test",
        slug: "test",
    }).save();

    test('Update simple', async () => {
        const product = await new Product({
            category: category._id,
            name: "Test",
            code: '1',
            barcode: '1',
            quantity: 10,
            retailPrice: 10,
            wholesalePrice: 8,
            deliveryPrice: 5,
            sizes: [],
        }).save();

        const data = {
            category: category._id,
            name: 'asd',
            quantity: 150,
            deliveryPrice: 33,
            wholesalePrice: 44,
            retailPrice: 55,
            unitOfMeasure: 'asd',
        }

        const { status } = await ProductController.put({ id: product._id, data });
        expect(status).toBe(201);
        const updatedProduct = await Product.findById(product._id);
        expect(updatedProduct.name).toBe(data.name);
        expect(updatedProduct.quantity).toBe(data.quantity);
        expect(updatedProduct.deliveryPrice).toBe(data.deliveryPrice);
        expect(updatedProduct.wholesalePrice).toBe(data.wholesalePrice);
        expect(updatedProduct.retailPrice).toBe(data.retailPrice);
        expect(updatedProduct.unitOfMeasure).toBe(data.unitOfMeasure);
    });

    test('Update variable', async () => {
        const product = await new Product({
            category: category._id,
            name: "Test",
            code: '1',
            barcode: '1',
            quantity: 10,
            retailPrice: 10,
            wholesalePrice: 8,
            deliveryPrice: 5,
            sizes: [
                {
                    size: "S",
                    quantity: 10,
                },
                {
                    size: "M",
                    quantity: 10,
                },
            ],
        }).save();

        const sizes = [
            {
                size: "S",
                quantity: 150,
            },
            {
                size: "M",
                quantity: 150,
            },
            {
                size: "L",
                quantity: 100
            }
        ]

        const data = {
            category: category._id,
            name: 'qwe',
            quantity: 100,
            deliveryPrice: 33,
            wholesalePrice: 44,
            retailPrice: 55,
            unitOfMeasure: 'qwe',
            sizes: JSON.stringify(sizes)
        }

        const { status } = await ProductController.put({ id: product._id, data });
        expect(status).toBe(201);

        const updatedProduct = await Product.findById(product._id).lean();
        expect(updatedProduct.name).toBe(data.name);
        expect(updatedProduct.quantity).toBe(data.quantity);
        expect(updatedProduct.deliveryPrice).toBe(data.deliveryPrice);
        expect(updatedProduct.wholesalePrice).toBe(data.wholesalePrice);
        expect(updatedProduct.retailPrice).toBe(data.retailPrice);
        expect(updatedProduct.unitOfMeasure).toBe(data.unitOfMeasure);
        expect(updatedProduct.sizes.length).toBe(sizes.length);
        for (let size of sizes) expect(updatedProduct.sizes.find(s => s.size === size.size)).toEqual(size);
    });

    test('Update image', async () => {
        const data = {
            name: "Test",
            description: "Test",
            code: "777",
            barcode: "7777777777777",
            quantity: 10,
            category: category._id,
            deliveryPrice: 10,
            wholesalePrice: 11,
            retailPrice: 12,
            unitOfMeasure: "Test",
        };

        // Fake uploaded img from form
        const image = [{ buffer: fs.readFileSync(path.join(dirname(fileURLToPath(import.meta.url)), 'testimg.png')) }];

        const { status, product, message } = await ProductController.post({ data, files: { image } });
        expect(message).toBeUndefined();
        expect(status).toBe(201);

        // Check image exists
        expect(product.image).toBeTypeOf('object');
        const exists1 = fs.existsSync(product.image.path);
        expect(exists1).toEqual(true); // saved to public/images/ folder

        // Now update product
        const { status: status2, product: product2 } = await ProductController.put({ id: product._id, data, files: { image } });
        expect(status2).toBe(201);

        setTimeout(() => {
            test('Old image deleted', async () => {
                const deleted = !fs.existsSync(product.image.path);
                expect(deleted).toEqual(true);
            })

            test('New image saved', async () => {
                expect(product2.image).toBeTypeOf('object');
                const saved = fs.existsSync(product2.image.path);
                expect(saved).toEqual(true); // saved to public/images/ folder
            });
        }, 500)
    })

    describe('Validate', async () => {
        await new Product({
            name: "Test",
            code: "444",
            barcode: "4444444444444",
            description: "Test",
            quantity: 10,
            category: category._id,
            deliveryPrice: 10,
            wholesalePrice: 11,
            retailPrice: 12,
            unitOfMeasure: "Test",
        }).save();

        const product2 = await new Product({
            name: "Test 2",
            code: "555",
            barcode: "5555555555555",
            description: "Test",
            quantity: 10,
            category: category._id,
            deliveryPrice: 10,
            wholesalePrice: 11,
            retailPrice: 12,
            unitOfMeasure: "Test",
        }).save();

        test('Product not found', async () => {
            const data = {
                name: "Test 2",
                code: "666",
                barcode: "6666666666666",
                description: "Test",
                quantity: 10,
                category: category._id,
                deliveryPrice: 10,
                wholesalePrice: 11,
                retailPrice: 12,
                unitOfMeasure: "Test",
            }

            const { status } = await ProductController.put({ id: '66d78e5e43a3cd5fbae610ea', data });
            expect(status).toBe(404);
        });

        test('Code already exists', async () => {
            const data = {
                name: "Test 2",
                code: "444",
                barcode: "4444444444444",
                description: "Test",
                quantity: 10,
                category: category._id,
                deliveryPrice: 10,
                wholesalePrice: 11,
                retailPrice: 12,
                unitOfMeasure: "Test",
            }

            const { status, property } = await ProductController.put({ id: product2._id, data });
            expect(status).toBe(400);
            expect(property).toBe('code');
        });

        test('Barcode already exists', async () => {
            const data = {
                name: "Test 2",
                code: "777",
                barcode: "4444444444444",
                description: "Test",
                quantity: 10,
                category: category._id,
                deliveryPrice: 10,
                wholesalePrice: 11,
                retailPrice: 12,
                unitOfMeasure: "Test",
            }

            const { status, property } = await ProductController.put({ id: product2._id, data });
            expect(status).toBe(400);
            expect(property).toBe('barcode');
        });
    });
});

describe('POST /products/restock', async () => {
    test('Restock', async () => {
        const category = await new Category({
            name: "Test",
            slug: "test",
        }).save();

        const simple = await new Product({
            category: category._id,
            name: "Test",
            code: '1',
            barcode: '1',
            quantity: 10,
            retailPrice: 10,
            wholesalePrice: 8,
            deliveryPrice: 5,
            sizes: [],
        }).save();

        const variable = await new Product({
            category: category._id,
            name: "Test",
            code: '1',
            barcode: '1',
            quantity: 10,
            retailPrice: 10,
            wholesalePrice: 8,
            sizes: [
                {
                    size: "S",
                    quantity: 10,
                },
                {
                    size: "M",
                    quantity: 10,
                },
            ],
            deliveryPrice: 5,
        }).save();

        const data = [
            {
                _id: simple._id,
                quantity: 10,
            },
            {
                _id: simple._id,
                quantity: 10,
            },
            {
                _id: variable._id,
                quantity: 10,
                sizes: ['S', 'M'],
                selectedSizes: ['S'],
            },
            {
                _id: variable._id,
                quantity: 10,
                sizes: ['S', 'M'],
                selectedSizes: ['S', 'M'],
            },
        ]

        const { status, doneProducts } = await ProductController.restock(data);
        await Product.find({}); // this is placed because the restock function is async and we need to wait for it

        expect(status).toBe(200);
        expect(doneProducts.length).toBe(2);

        const simpleResult = doneProducts.find(p => p._id.toString() == simple._id.toString());
        expect(simpleResult.quantity).toBe(30);

        const variableResult = doneProducts.find(p => p._id.toString() == variable._id.toString());
        expect(variableResult.quantity).toBe(20);
        expect(variableResult.sizes.find(s => s.size === "S").quantity).toBe(30);
        expect(variableResult.sizes.find(s => s.size === "M").quantity).toBe(20);
    });

    describe('Validation', async () => {
        test('Simple product quantity', async () => {
            const category = await new Category({
                name: "Test",
                slug: "test",
            }).save();

            const simple = await new Product({
                category: category._id,
                name: "Test",
                code: '1',
                barcode: '1',
                quantity: 10,
                retailPrice: 10,
                wholesalePrice: 8,
                deliveryPrice: 5,
                sizes: [],
            }).save();

            const data = [
                {
                    _id: simple._id,
                    quantity: 0,
                }
            ];

            const { status, property } = await ProductController.restock(data);
            expect(status).toBe(400);
            expect(property).toEqual('quantity');
        });

        test('Variable product quantity', async () => {
            const category = await new Category({
                name: "Test",
                slug: "test",
            }).save();

            const variable = await new Product({
                category: category._id,
                name: "Test",
                code: '1',
                barcode: '1',
                quantity: 10,
                retailPrice: 10,
                wholesalePrice: 8,
                sizes: [
                    {
                        size: "S",
                        quantity: 10,
                    },
                    {
                        size: "M",
                        quantity: 10,
                    },
                ],
                deliveryPrice: 5,
            }).save();

            const data = [{
                _id: variable._id,
                quantity: 0,
                sizes: ['S', 'M'],
                selectedSizes: ['S'],
            }];

            const { status, property } = await ProductController.restock(data);
            expect(status).toBe(400);
            expect(property).toEqual('quantity');
        });

        test('Variable product non-existing size', async () => {
            const category = await new Category({
                name: "Test",
                slug: "test",
            }).save();

            const variable = await new Product({
                category: category._id,
                name: "Test",
                code: '1',
                barcode: '1',
                quantity: 10,
                retailPrice: 10,
                wholesalePrice: 8,
                sizes: [
                    {
                        size: "S",
                        quantity: 10,
                    },
                    {
                        size: "M",
                        quantity: 10,
                    },
                ],
                deliveryPrice: 5,
            }).save();

            const data = [{
                _id: variable._id,
                quantity: 10,
                sizes: ['S', 'M'],
                selectedSizes: ['L'],
            }];

            const { status, property } = await ProductController.restock(data);
            expect(status).toBe(400);
            expect(property).toEqual('size');
        });

        test('Variable product no selected size', async () => {
            const category = await new Category({
                name: "Test",
                slug: "test",
            }).save();

            const variable = await new Product({
                category: category._id,
                name: "Test",
                code: '1',
                barcode: '1',
                quantity: 10,
                retailPrice: 10,
                wholesalePrice: 8,
                sizes: [
                    {
                        size: "S",
                        quantity: 10,
                    },
                    {
                        size: "M",
                        quantity: 10,
                    },
                ],
                deliveryPrice: 5,
            }).save();

            const data = [{
                _id: variable._id,
                quantity: 10,
                sizes: ['S', 'M'],
                selectedSizes: [],
            }];

            const { status, property } = await ProductController.restock(data);
            expect(status).toBe(400);
            expect(property).toEqual('size');
        });

        test('Non-existing product', async () => {
            const data = [{
                _id: '66d78e5e43a3cd5fbae610ea',
                quantity: 10,
            }];

            const { status } = await ProductController.restock(data);
            expect(status).toBe(404);
        });
    });
});

describe('DELETE /products/:id', async () => {
    const category = await new Category({
        name: "Test",
        slug: "test",
    }).save();

    describe('Delete product', async () => {
        // First create a product with image
        const data = {
            name: "Test",
            code: "999",
            barcode: "9999999999999",
            description: "Test",
            quantity: 10,
            category: category._id,
            deliveryPrice: 10,
            wholesalePrice: 11,
            retailPrice: 12,
            unitOfMeasure: "Test",
        };

        // Fake uploaded img from form
        const image = [{ buffer: fs.readFileSync(path.join(dirname(fileURLToPath(import.meta.url)), 'testimg.png')) }];

        const { status, product, message } = await ProductController.post({ data, files: { image } });
        expect(message).toBeUndefined();
        expect(status).toBe(201);
        await Promise.resolve();

        const { status: status2 } = await ProductController.delete(product._id);
        await Promise.resolve();
        test('Product deleted', async () => {
            expect(status2).toBe(204);
            expect(await Product.findById(product._id)).toBeNull();
        });

        test('Image deleted', async () => {
            expect(fs.existsSync(product.image.path)).toBe(false);
        })
    });

    test('Non-existing product', async () => {
        const { status } = await ProductController.delete('66d78e5e43a3cd5fbae610ea');
        expect(status).toBe(404);
    });

    test('Product with orders marked as deleted', async () => {
        const product = await new Product({
            name: "Test",
            code: "999",
            barcode: "9999999999999",
            description: "Test",
            quantity: 10,
            category: category._id,
            deliveryPrice: 10,
            wholesalePrice: 11,
            retailPrice: 12,
            unitOfMeasure: "Test",
        }).save(); // bypass the required fields in the model

        await new Order({
            _id: '66d78e5343a3cd5fbae60ad0',
            products: [
                { product: product._id.toString(), price: 5, quantity: 10, unitOfMeasure: 'бр.' },
            ]
        }, { bypassDocumentValidation: true }).save(); // bypass the required fields in the model

        const { status } = await ProductController.delete(product._id.toString());
        expect(status).toBe(204);
        const product2 = await Product.findById(product._id.toString());
        expect(product2).not.toBeNull();
        expect(product2.deleted).toBe(true);
    })
});