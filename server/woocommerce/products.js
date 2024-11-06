import { WooCommerce } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
import { Product } from "../models/product.js";
import { ProductAttribute } from "../models/product_attribute.js";
import { retry } from "./common.js";
import cron from 'node-cron';

export async function WooCheckProductAttributesINIT() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    // Check if all products attributes exist in WooCommerce, if not - create them

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
    ];

    WooCommerce.get("products/attributes").then(async (response) => {
        const mongoAttributes = await ProductAttribute.find({});
        for (const attribute of attributes) {
            let found = false;
            for (const existingAttribute of response.data) {
                if (existingAttribute.name == attribute.name) {
                    found = true;

                    // Check if attribute exists in mongodb
                    const inMongo = mongoAttributes.find(m => 'pa_' + m.slug == existingAttribute.slug);

                    if (inMongo) {
                        inMongo.woocommerce.id = existingAttribute.id;
                        inMongo.save();
                    } else {
                        attribute.woocommerce = { id: existingAttribute.id };
                        ProductAttribute.create(attribute);
                    }

                    break;
                }
            }

            if (!found) {
                WooCommerce.post("products/attributes", attribute).then(() => {
                    // Success
                    console.log(`Attribute "${attribute.name}" successfully created in WooCommerce!`)

                    // Check if attribute exists in mongodb
                    const inMongo = mongoAttributes.find(m => m.slug == attribute.slug);

                    if (inMongo) {
                        inMongo.woocommerce.id = attribute.id;
                        inMongo.save();
                    } else {
                        attribute.woocommerce = { id: attribute.id };
                    }
                    ProductAttribute.create(attribute);
                }).catch((error) => {
                    // Invalid request, for 4xx and 5xx statuses
                    console.error("Response Status:", error.response.status);
                    console.error("Response Headers:", error.response.headers);
                    console.error("Response Data:", error.response.data);
                });
            }
        }

        console.log("All products attributes exist in WooCommerce!")
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}

export async function WooUpdateQuantityProducts(products) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p.woocommerce.id); // only find products that are in WooCommerce (some can be hidden)

    // Do it in batches of 100
    console.log('Starting update for ' + filtered.length + ' products...')
    for (let i = 0; i < filtered.length; i += 100) {
        const batch = filtered.slice(i, i + 100).map(p => ({ id: p.woocommerce.id, stock_quantity: p.quantity }));
        await retry(async () => {
            console.log('Starting work on batch: ' + i)
            const req = await WooCommerce.post('products/batch', { update: batch });
            if (req.status === 200) console.log('Products quantity successfully updated in WooCommerce!')
            else console.error('Error batch updating products quantity in WooCommerce!')
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
        for (let i = 0; i < Math.ceil(doneProducts.length / 100); i += 100) {
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

                await Promise.all(productsToSave.map(p => p.save()));
                console.log(`Product batch ${i / 100 + 1} successfully created in WooCommerce!`)
            }).catch((error) => {
                console.error(error);
                // Invalid request, for 4xx and 5xx statuses
                console.error("Response Status:", error.response.status);
                console.error("Response Headers:", error.response.headers);
                console.error("Response Data:", error.response.data);
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

    if (product.sizes.length > 0) {
        const mongoAttributes = await ProductAttribute.find({});

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
        ]
    }

    if (process.env.ENV !== 'dev' && product.image) {
        data.images = [{ src: product.image.url }];

        if (product.additionalImages) {
            for (const image of product.additionalImages)
                data.images.push({ src: image.url });
        }
    }

    await retry(async () => {
        const response = await WooCommerce.post("products", data);

        product.woocommerce = {
            id: response.data.id,
            permalink: response.data.permalink
        }

        await product.save();
        console.log(`Product ${product.code} successfully created in WooCommerce!`);
    });
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

    if (product.sizes.length > 0) {
        const mongoAttributes = await ProductAttribute.find({});

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

    if (process.env.ENV !== 'dev' && product.image) {
        data.images = [{ src: product.image.url }];

        if (product.additionalImages) {
            for (const image of product.additionalImages)
                data.images.push({ src: image.url });
        }
    }

    await retry(async () => {
        await WooCommerce.put(`products/${product.woocommerce.id}`, data);
        console.log('Product successfully edited in WooCommerce!')
    });
}

export async function WooDeleteProduct(id) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    await retry(async () => {
        await WooCommerce.delete(`products/${id}`);
        console.log('Product successfully deleted in WooCommerce!')
    });
}

export async function checkProductsInWoo() {
    // This function compares the quantity and price of the products in the database with the woocommerce store to see if there are any changes and update woocommerce accordingly
    if (!WooCommerce) return;

    // Get all products from woo
    let done = false;
    let offset = 0;
    const wooProducts = [];

    console.log('Starting WooCommerce products batch get...');
    while (done == false) {
        const req = await WooCommerce.get("products", { per_page: 100, offset, orderby: 'id' });
        const products = req.data;

        if (products.length == 0) {
            done = true;
            break;
        }

        wooProducts.push(...products);

        offset += 100;
        console.log(`Got ${wooProducts.length} products from WooCommerce! Attempting to get more...`);
    }

    // Get all products from app
    const appProducts = await Product.find({ hidden: false });

    const productsToCreate = [];
    const productsToUpdate = [];
    console.log('Starting WooCommerce products check...');
    for (let product of appProducts) {
        // Check if product exists in woo
        if (!wooProducts.find(p => p.id == product.woocommerce.id)) {
            productsToCreate.push(product);
            // console.log(`Product with app ID: ${product._id} does not exist in WooCommerce! Attempting to create it...`);
            // WooCreateProduct(product);
            continue;
        }

        // Check if product data is correct
        const wooProduct = wooProducts.find(p => p.id == product.woocommerce.id);
        if (product.wholesalePrice != wooProduct.regular_price || product.quantity != wooProduct.stock_quantity) {
            productsToUpdate.push(product);
            // console.log(`Product with woo ID: ${product.woocommerce.id} does not have correct data in WooCommerce! Attempting to edit it...`);
            // WooEditProduct(product, product);
            // console.log(`Successfully edited product with app ID: ${product._id}`);
        }
    }

    // TODO BATCH CREATE AND UPDATE
    console.log('Finished WooCommerce products check!');
}
// checkProductsInWoo();
// Run this every 3 hours
// cron.schedule('0 */3 * * *', async () => {
// if (!WooCommerce) return;
//     console.log('Running WooCommerce products CRON...')
//     checkProductsInWoo();
// });