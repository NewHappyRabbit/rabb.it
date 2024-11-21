import { WooCommerce } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
import { Product } from "../models/product.js";
import { ProductAttribute } from "../models/product_attribute.js";
import { retry } from "./common.js";
import cron from 'node-cron';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

export async function WooCheckProductAttributesINIT() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    // Check if all products attributes exist in WooCommerce, if not - create them
    console.log('Starting WooCommerce products attributes check...');

    // Attributes are hard-coded for now
    const attributes = [
        {
            name: 'Бройки в серия',
            slug: 'pcs',
            order_by: 'name_num'
        },
        {
            name: 'Цена на брой',
            slug: 'pieceprice',
            order_by: 'name_num'
        },
        {
            name: 'Размер',
            slug: 'size',
            order_by: 'name_num'
        },
        { // This is used for the viber url to display size correctly
            name: 'Размер за Viber',
            slug: 'size_viber',
            order_by: 'name_num'
        },
        {
            name: 'Сезон',
            slug: 'season',
            order_by: 'name'
        },
        {
            name: 'Категория',
            slug: 'in_category',
            order_by: 'name'
        },
        {
            name: 'Пол',
            slug: 'sex',
            order_by: 'name'
        },
    ];

    const mongoAttributes = await ProductAttribute.find({});
    const wooAttributes = await WooCommerce.get("products/attributes").then((response) => response.data);

    for (const attribute of attributes) {
        // Check if it exists in db
        let inMongo = mongoAttributes.find(m => m.slug == attribute.slug);

        if (!inMongo) {
            console.log(`Creating "${attribute.name}" in mongo...`)
            await ProductAttribute.create(attribute);
            inMongo = await ProductAttribute.findOne({ slug: attribute.slug });
        }

        // Check if it exists in woo
        const inWoo = wooAttributes.find(w => w.slug == "pa_" + attribute.slug);
        if (!inWoo) {
            console.log(`Creating "${attribute.name}" in woo...`)
            // Create it in woo
            const wooAttribute = await WooCommerce.post("products/attributes", attribute).then((response) => response.data);

            inMongo.woocommerce = { id: wooAttribute.id };
        } else inMongo.woocommerce = { id: inWoo.id };

        await inMongo.save();
    }

    console.log("Products attributes check done!")
}

export async function WooUpdateQuantityProducts(products) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p?.woocommerce?.id && p.deleted === false && p.hidden === false); // only find products that are in WooCommerce (some can be hidden)

    // Do it in batches of 100
    console.log('Starting update for ' + filtered.length + ' products...')
    for (let i = 0; i < filtered.length; i += 100) {
        const batch = filtered.slice(i, i + 100).map(p => ({ id: p.woocommerce.id, stock_quantity: p.quantity }));
        await retry(async () => {
            console.log('Starting work on batch: ' + i)
            await WooCommerce.post('products/batch', { update: batch }).then(() => {
                console.log('Products quantity successfully updated in WooCommerce!')
            }).catch((error) => {
                console.error('Error batch updating products quantity in WooCommerce!')
                console.error(error);
            });
        });
    }
}

export async function WooCreateProductsINIT() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const mongoAttributes = await ProductAttribute.find({});
    const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
    const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
    const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
    const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;
    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');

    const products = await Product.find({ woocommerce: { $exists: false }, hidden: false });

    const doneProducts = [];
    for (let product of products) {
        const category = await Category.findById(product.category);
        const data = {
            name: product.name,
            slug: "p" + product.code,
            description: product.description,
            regular_price: product.wholesalePrice.toString(),
            sku: product.code,
            categories: [{ id: category.woocommerce.id }],
            stock_quantity: product.quantity,
            "manage_stock": true, // enables the stock management
        }

        // If not in live environment, set product status as private to not show it for clients
        if (process.env.ENV === 'dev') {
            data.status = 'private';
            data.catalog_visibility = 'hidden';
        }

        if (product.sizes.length > 0) {
            const simpleSizes = product.sizes.map(s => s.size);
            const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

            data.attributes = [
                { // pcs
                    id: pcsId,
                    visible: true,
                    variation: false,
                    options: (product.sizes.length * product.multiplier).toString(),
                },
                { // size
                    id: sizeId,
                    visible: true,
                    variation: false,
                    options: simpleSizes
                },
                { // viber size
                    id: viberSizeId,
                    visible: false,
                    variation: false,
                    options: viberSizes// Get the first and last size and do 'X-Y'
                },
                { // piecePrice
                    id: piecePriceId,
                    visible: true,
                    variation: false,
                    options: (product.wholesalePrice / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
                },
            ]
        }

        if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
            data.attributes.push({
                id: seasonAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: JSON.parse(product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value)
            });

        if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
            data.attributes.push({
                id: in_categoryAttr.woocommerce.id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
            data.attributes.push({
                id: sexAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: [product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value]
            });

        if (process.env.ENV !== 'dev' && product.image) {
            data.images = [{ src: product.image.url }];

            if (product.additionalImages) {
                for (const image of product.additionalImages)
                    data.images.push({ src: image.url });
            }
        }

        doneProducts.push(data);
    }

    if (doneProducts.length > 0) {
        // Batch accepts max 100 products per request
        for (let i = 0; i < doneProducts.length; i += 100) {
            const productsToSave = [];
            const batch = doneProducts.slice(i, i + 100);
            await WooCommerce.post("products/batch", { create: batch }).then(async (response) => {
                // Success
                for (let product of response.data.create) {
                    const productInDb = products.find(p => p.code === product.sku);

                    productInDb.woocommerce = {
                        id: product.id,
                        permalink: product.permalink
                    }

                    productsToSave.push(productInDb);
                }

                await Promise.all(productsToSave.map(async (p) => await p.save()));
                console.log(`Product batch ${i} successfully created in WooCommerce!`)
            }).catch((error) => {
                console.error(error);
            });
        }
    }
}

export async function WooCreateProduct(product) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const category = await Category.findById(product.category);

    const data = {
        name: product.name,
        slug: "p" + product.code,
        description: product.description,
        regular_price: product.wholesalePrice.toString(),
        sku: product.code,
        categories: [{ id: category.woocommerce.id }],
        stock_quantity: product.quantity,
        "manage_stock": true, // enables the stock management
    }

    // If not in live environment, set product status as private to not show it for clients
    if (process.env.ENV === 'dev') {
        data.status = 'private';
        data.catalog_visibility = 'hidden';
    }

    const mongoAttributes = await ProductAttribute.find({});
    if (product.sizes.length > 0) {
        const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
        const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
        const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
        const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;

        const simpleSizes = product.sizes.map(s => s.size);
        const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

        data.attributes = [
            { // pcs
                id: pcsId,
                visible: true,
                variation: false,
                options: (product.sizes.length * product.multiplier).toString(),
                //TODO TEST IF MULTIPLIER WORSK IN WOOCOMMERCE
            },
            { // size
                id: sizeId,
                visible: true,
                variation: false,
                options: simpleSizes
            },
            { // viber size
                id: viberSizeId,
                visible: false,
                variation: false,
                options: viberSizes// Get the first and last size and do 'X-Y'
            },
            { // piecePrice
                id: piecePriceId,
                visible: true,
                variation: false,
                options: (product.wholesalePrice / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
                //TODO TEST IF MULTIPLIER WORSK IN WOOCOMMERCE
            },
        ];

    } else data.attributes = [];

    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');

    console.log(in_categoryAttr)

    if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
        data.attributes.push({
            id: seasonAttr.woocommerce.id,
            visible: true,
            variation: false,
            options: JSON.parse(product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value)
        });

    if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
        data.attributes.push({
            id: in_categoryAttr.woocommerce.id,
            visible: false,
            variation: false,
            options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
        });

    if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
        data.attributes.push({
            id: sexAttr.woocommerce.id,
            visible: true,
            variation: false,
            options: [product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value]
        });

    if (process.env.ENV !== 'dev' && product.image) {
        data.images = [{ src: product.image.url }];

        if (product.additionalImages) {
            for (const image of product.additionalImages)
                data.images.push({ src: image.url });
        }
    }

    await retry(async () => {
        await WooCommerce.post("products", data).then(async (response) => {
            product.woocommerce = {
                id: response.data.id,
                permalink: response.data.permalink
            }

            await product.save();
            console.log(`Product with id ${product._id} successfully created in WooCommerce!`);
        }).catch((error) => {
            console.error('Failed to create product in WooCommerce with _id: ' + product._id);
            console.error(error);
        });

    });
}

export async function WooCreateProductsBatch(products) {
    const mongoAttributes = await ProductAttribute.find({});
    const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
    const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
    const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
    const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;
    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');

    const doneProducts = [];
    for (let product of products) {
        const category = await Category.findById(product.category);
        const data = {
            name: product.name,
            slug: "p" + product.code,
            description: product.description,
            regular_price: product.wholesalePrice.toString(),
            sku: product.code,
            categories: [{ id: category.woocommerce.id }],
            stock_quantity: product.quantity,
            "manage_stock": true, // enables the stock management
        }

        // If not in live environment, set product status as private to not show it for clients
        if (process.env.ENV === 'dev') {
            data.status = 'private';
            data.catalog_visibility = 'hidden';
        }

        if (product.sizes.length > 0) {
            const simpleSizes = product.sizes.map(s => s.size);
            const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

            data.attributes = [
                { // pcs
                    id: pcsId,
                    visible: true,
                    variation: false,
                    options: (product.sizes.length * product.multiplier).toString(),
                },
                { // size
                    id: sizeId,
                    visible: true,
                    variation: false,
                    options: simpleSizes
                },
                { // viber size
                    id: viberSizeId,
                    visible: false,
                    variation: false,
                    options: viberSizes// Get the first and last size and do 'X-Y'
                },
                { // piecePrice
                    id: piecePriceId,
                    visible: true,
                    variation: false,
                    options: (product.wholesalePrice / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
                },
            ]
        } else data.attributes = [];

        if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
            data.attributes.push({
                id: seasonAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: JSON.parse(product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value)
            });

        if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
            data.attributes.push({
                id: in_categoryAttr.woocommerce.id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
            data.attributes.push({
                id: sexAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: [product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value]
            });

        if (process.env.ENV !== 'dev' && product.image) {
            data.images = [{ src: product.image.url }];

            if (product.additionalImages) {
                for (const image of product.additionalImages)
                    data.images.push({ src: image.url });
            }
        }

        doneProducts.push(data);
    }

    if (doneProducts.length > 0) {
        // Batch accepts max 100 products per request
        for (let i = 0; i < doneProducts.length; i += 100) {
            const productsToSave = [];
            const batch = doneProducts.slice(i, i + 100);
            await WooCommerce.post("products/batch", { create: batch }).then(async (response) => {
                // Success
                for (let product of response.data.create) {
                    const productInDb = products.find(p => p.code === product.sku);

                    if (!productInDb) console.error(`Product with Woo SKU: ${product.sku} not found in database!`);

                    productInDb.woocommerce = {
                        id: product.id,
                        permalink: product.permalink
                    }

                    productsToSave.push(productInDb);
                }

                await Promise.all(productsToSave.map(async (p) => await p.save()));
                console.log(`Product batch ${i} successfully created in WooCommerce!`)
            }).catch((error) => {
                console.error('Failed to create product batch in WooCommerce!');
                console.error(error);
            });
        }
    }
}

export async function WooEditProductsBatch(products) {
    const mongoAttributes = await ProductAttribute.find({});
    const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
    const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
    const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
    const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;
    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');

    const doneProducts = [];
    for (let product of products) {
        const category = await Category.findById(product.category);
        const data = {
            id: product.woocommerce.id,
            name: product.name,
            slug: "p" + product.code,
            description: product.description,
            regular_price: product.wholesalePrice.toString(),
            sku: product.code,
            categories: [{ id: category.woocommerce.id }],
            stock_quantity: product.quantity,
            "manage_stock": true, // enables the stock management
        }

        // If not in live environment, set product status as private to not show it for clients
        if (process.env.ENV === 'dev') {
            data.status = 'private';
            data.catalog_visibility = 'hidden';
        }

        if (product.sizes.length > 0) {
            const simpleSizes = product.sizes.map(s => s.size);
            const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

            data.attributes = [
                { // pcs
                    id: pcsId,
                    visible: true,
                    variation: false,
                    options: (product.sizes.length * product.multiplier).toString(),
                },
                { // size
                    id: sizeId,
                    visible: true,
                    variation: false,
                    options: simpleSizes
                },
                { // viber size
                    id: viberSizeId,
                    visible: false,
                    variation: false,
                    options: viberSizes// Get the first and last size and do 'X-Y'
                },
                { // piecePrice
                    id: piecePriceId,
                    visible: true,
                    variation: false,
                    options: (product.wholesalePrice / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
                },
            ]
        } else data.attributes = [];

        if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
            data.attributes.push({
                id: seasonAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: JSON.parse(product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value)
            });

        if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
            data.attributes.push({
                id: in_categoryAttr.woocommerce.id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
            data.attributes.push({
                id: sexAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: [product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value]
            });

        if (process.env.ENV !== 'dev' && product.image) {
            data.images = [{ src: product.image.url }];

            if (product.additionalImages) {
                for (const image of product.additionalImages)
                    data.images.push({ src: image.url });
            }
        }

        doneProducts.push(data);
    }

    if (doneProducts.length > 0) {
        // Batch accepts max 100 products per request
        for (let i = 0; i < doneProducts.length; i += 100) {
            const batch = doneProducts.slice(i, i + 100);
            await WooCommerce.post("products/batch", { update: batch }).then(async () => {
                // Success
                console.log(`Product batch ${i} successfully updated in WooCommerce!`)
            }).catch((error) => {
                console.error('Failed to update product batch in WooCommerce!');
                console.error(error);
            });
        }
    }
}

export async function WooDeleteProductsBatch(products) {
    // Batch accepts max 100 products per request
    for (let i = 0; i < products.length; i += 100) {
        const batch = products.slice(i, i + 100).map(p => p.id);
        await WooCommerce.post("products/batch", { delete: batch }).then(async () => {
            // Success
            console.log(`Product batch ${i} successfully deleted in WooCommerce!`)
        }).catch((error) => {
            console.error('Failed to delete product batch in WooCommerce!');
            console.error(error);
        });
    }
}

export async function WooEditProduct(product) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used
    const data = {
        name: product.name,
        slug: "p" + product.code,
        description: product.description,
        regular_price: product.wholesalePrice.toString(),
        sku: product.code,
        stock_quantity: product.quantity,
    }
    const category = await Category.findById(product.category);
    if (category) data.categories = [{ id: category.woocommerce.id }];

    const mongoAttributes = await ProductAttribute.find({});
    if (product.sizes.length > 0) {
        const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
        const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
        const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
        const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;

        const simpleSizes = product.sizes.map(s => s.size);
        const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

        data.attributes = [
            { // pcs
                id: pcsId,
                visible: true,
                variation: false,
                options: product.sizes.length.toString()
            },
            { // size
                id: sizeId,
                visible: true,
                variation: false,
                options: simpleSizes
            },
            { // viber size
                id: viberSizeId,
                visible: false,
                variation: false,
                options: viberSizes // Get the first and last size and do 'X-Y'
            },
            { // piecePrice
                id: piecePriceId,
                visible: true,
                variation: false,
                options: (product.wholesalePrice / (product.sizes.length * product.multiplier)).toFixed(2).toString()
            },
        ]
    } else data.attributes = [];

    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');

    if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
        data.attributes.push({
            id: seasonAttr.woocommerce.id,
            visible: true,
            variation: false,
            options: JSON.parse(product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value)
        });

    if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
        data.attributes.push({
            id: in_categoryAttr.woocommerce.id,
            visible: false,
            variation: false,
            options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
        });

    if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
        data.attributes.push({
            id: sexAttr.woocommerce.id,
            visible: true,
            variation: false,
            options: [product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value]
        });

    if (process.env.ENV !== 'dev' && product.image) {
        data.images = [{ src: product.image.url }];

        if (product.additionalImages) {
            for (const image of product.additionalImages)
                data.images.push({ src: image.url });
        }
    }

    await retry(async () => {
        await WooCommerce.put(`products/${product.woocommerce.id}`, data).then(async (res) => {
            // Success
            console.log('Product successfully edited in WooCommerce!')
        }).catch((error) => {
            // Invalid request, for 4xx and 5xx statuses
            console.error('Failed to edit product in WooCommerce with _id: ' + product._id);
            console.error(error);
        });
    });
}

export async function WooDeleteProduct(id) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    await retry(async () => {
        await WooCommerce.delete(`products/${id}`).then(async () => {
            // Success
            console.log('Product successfully deleted in WooCommerce!')
        }).catch((error) => {
            // Invalid request, for 4xx and 5xx statuses
            console.error('Failed to delete product in WooCommerce with _id: ' + id);
            console.error(error);
        });
    });
}

async function updateAllAttributes() {
    const products = await Product.find({ sizes: { $ne: [] }, hidden: { $ne: true }, deleted: { $ne: true }, "woocommerce.id": { $exists: true } });

    const mongoAttributes = await ProductAttribute.find({});
    const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
    const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
    const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
    const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;
    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');

    const doneProducts = [];

    for (let product of products) {
        const data = {
            id: product.woocommerce.id,
        }

        const simpleSizes = product.sizes.map(s => s.size);
        const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

        data.attributes = [
            { // pcs
                id: pcsId,
                visible: true,
                variation: false,
                options: (product.sizes.length * product.multiplier).toString(),
            },
            { // size
                id: sizeId,
                visible: true,
                variation: false,
                options: simpleSizes
            },
            { // viber size
                id: viberSizeId,
                visible: false,
                variation: false,
                options: viberSizes// Get the first and last size and do 'X-Y'
            },
            { // piecePrice
                id: piecePriceId,
                visible: true,
                variation: false,
                options: (product.wholesalePrice / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
            },
        ]

        if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
            data.attributes.push({
                id: seasonAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: JSON.parse(product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value)
            });

        if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
            data.attributes.push({
                id: in_categoryAttr.woocommerce.id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
            data.attributes.push({
                id: sexAttr.woocommerce.id,
                visible: true,
                variation: false,
                options: [product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value]
            });

        doneProducts.push(data);
    }

    // Batch accepts max 100 products per request
    for (let i = 0; i < doneProducts.length; i += 100) {
        const batch = doneProducts.slice(i, i + 100);
        await WooCommerce.post("products/batch", { update: batch }).then(async () => {
            // Success
            console.log(`Product batch ${i} successfully updated in WooCommerce!`)
        }).catch((error) => {
            console.error('Failed to update product batch in WooCommerce!');
            console.error(error);
        });
    }

    console.log('Done updating Woo products attributes!')
}

export async function checkProductsInWoo() {
    // This function compares the quantity and price of the products in the database with the woocommerce store to see if there are any changes and update woocommerce accordingly
    if (!WooCommerce) return;
    // Get all products from woo
    let done = false;
    let offset = 0;
    const filter = { hidden: { $ne: true }, deleted: { $ne: true } };
    /* 
        const wooProducts = [];
        const appProducts = await Product.find(filter);
    
        console.log('Starting WooCommerce products batch get...');
        while (done == false) {
            const req = await WooCommerce.get("products", { per_page: 100, offset, orderby: 'id' });
            const products = req.data;
            if (products.length < 100) done = true;
    
            wooProducts.push(...products);
    
            offset += 100;
            console.log(`Got ${wooProducts.length} products from WooCommerce! Attempting to get more...`);
        }
     */

    ///* DEV ONLY
    // Save to file
    // fs.writeFileSync('server/woocommerce/wooProducts.json', JSON.stringify(wooProducts));
    // return;

    const appProducts = await Product.find(filter);
    var wooProducts = fs.readFileSync('server/woocommerce/wooProducts.json', 'utf8');
    wooProducts = JSON.parse(wooProducts);
    //*/

    // Get all products from app
    const productsToCreate = [];
    const productsToUpdate = [];
    const productsToSave = [];
    const wooProductsToDelete = [];
    console.log('Starting WooCommerce products check...');
    for (let product of appProducts) {
        // Check if product exists in woo
        if (!wooProducts.find(p => p.id == product.woocommerce.id)) {
            // Check if product exists in app and woo, but id was incorrect
            if (product.code && wooProducts.find(p => p.sku === product.code)) {
                console.log('Found product with incorrect id in WooCommerce! App _id: ' + product._id);
                const tempproduct = wooProducts.find(p => p.sku === product.code);
                product.woocommerce.id = tempproduct.id;
                product.permalink = tempproduct.permalink;
                productsToSave.push(product);
                continue;
            } else {
                productsToCreate.push(product);
                continue;
            }
        }

        // Check if product data is correct
        const wooProduct = wooProducts.find(p => p.id == product.woocommerce.id);
        if (product.wholesalePrice != wooProduct.regular_price || product.quantity != wooProduct.stock_quantity) {
            productsToUpdate.push(product);
        }
    }

    if (productsToSave.length > 0) {
        console.log('Found ' + productsToSave.length + ' products to save in database! Starting...');
        console.log(productsToSave.map(p => p._id).join(', '));
        // await Promise.resolve(productsToSave.map(async p => await p.save()));
        console.log('Finished saving database products!');
    }

    if (productsToCreate.length > 0) {
        console.log('Found ' + productsToCreate.length + ' products to create in WooCommerce! Starting...');
        console.log(productsToCreate.map(p => p._id).join(', '));
        // await WooCreateProductsBatch(productsToCreate);
        console.log('Finished WooCommerce products creation!');
    }

    if (productsToUpdate.length > 0) {
        console.log('Found ' + productsToUpdate.length + ' products to update in WooCommerce! Starting...');
        console.log(productsToUpdate.map(p => p._id).join(', '));
        // await WooEditProductsBatch(productsToUpdate);
        console.log('Finished WooCommerce products update!');
    }

    const productsAfterSave = await Product.find(filter); // if any products were edited in the before steps, get the actual new data
    const hiddenOrDeletedProducts = await Product.find({ $or: [{ hidden: true }, { deleted: true }] }); // get all deleted or hidden products
    for (let product of wooProducts) {
        // Check if any product in woo doesnt exist in app
        if (!productsAfterSave.find(p => p.woocommerce.id == product.id))
            wooProductsToDelete.push(product);

        // Check if any hidden or deleted product exists in woocommerce
        if (hiddenOrDeletedProducts.find(p => p.woocommerce.id == product.id))
            wooProductsToDelete.push(product);
    }

    if (wooProductsToDelete.length > 0) {
        console.log('Found ' + wooProductsToDelete.length + ' products to delete in WooCommerce! Starting...');
        console.log(wooProductsToDelete.map(p => p.id).join(', '));
        // await WooDeleteProductsBatch(wooProductsToDelete);
        console.log('Finished WooCommerce products deletion!');
    }

    console.log('Finished WooCommerce products check!');
}
// checkProductsInWoo();
// Run this every 3 hours
// cron.schedule('0 */3 * * *', async () => {
// if (!WooCommerce) return;
//     console.log('Running WooCommerce products CRON...')
//     checkProductsInWoo();
// });