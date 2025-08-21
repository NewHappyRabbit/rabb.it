import { WooCommerce_Shops } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
import { Product } from "../models/product.js";
import { ProductAttribute } from "../models/product_attribute.js";

async function findAndDeleteHidden() {
    const hiddenProducts = await Product.find({ hidden: true });

    console.log(`Found ${hiddenProducts.length} hidden products, looking for them in WooCommerce...`);

    for (let shop of retailShops) {
        const idsArray = [];
        for (let product of hiddenProducts) {
            try {
                const req = await shop.get('products', {
                    sku: product.code,
                })
                if (req.data?.length === 0) continue;
                const found = req.data[0];
                const id = found.id
                if (!idsArray.includes(id)) idsArray.push(id);
            } catch (error) {
                console.error(`Error finding hidden product ${product.code} in WooCommerce [${shop.url}]`);
                console.error(error);
            }
        }

        if (idsArray.length === 0) {
            console.log(`No hidden products found in WooCommerce [${shop.url}]`);
            continue;
        };

        console.log(`Found ${idsArray.length} hidden products in WooCommerce [${shop.url}], deleting them...`);
        for (let id of idsArray) {
            try {
                await shop.delete(`products/${id}`, { force: true });
                console.log(`Deleted hidden product with id ${id} in WooCommerce [${shop.url}]`);
            } catch (error) {
                console.error(`Error deleting hidden product with id ${id} in WooCommerce [${shop.url}]`);
                console.error(error);
            }
        }
    }
}

async function generateWholesaleProductsData(products, shop) {
    const mongoAttributes = await ProductAttribute.find({});
    const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.find(el => el.woo_url == shop.url).id;
    const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.find(el => el.woo_url == shop.url).id;
    const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.find(el => el.woo_url == shop.url).id;
    const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.find(el => el.woo_url == shop.url).id;
    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');
    const sizesGroupsAttr = mongoAttributes.find(m => m.slug == 'sizes_groups');

    async function formatData(product, shop) {
        const category = await Category.findById(product.category);
        const data = {
            name: product.name,
            slug: "p" + product.code,
            description: product.description,
            regular_price: product.wholesalePrice.toString(),
            sku: product.code,
            categories: [{ id: category.woocommerce.find(el => el.woo_url == shop.url).id }],
            stock_quantity: product.quantity,
            "manage_stock": true, // enables the stock management
            attributes: [],
        }

        if (product.saleWholesalePrice) data.sale_price = product.saleWholesalePrice.toString();

        if (product?.woocommerce.length > 0 && product.woocommerce.find(el => el.woo_url == shop.url))
            data.id = product.woocommerce.find(el => el.woo_url == shop.url).id;

        // If not in live environment, set product status as private to not show it for clients
        if (process.env.ENV === 'dev') {
            data.status = 'private';
            data.catalog_visibility = 'hidden';
        }

        if (product.sizes.length > 0) {
            const simpleSizes = product.sizes.map(s => s.size);
            const viberSizes = simpleSizes.length > 1 ? `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}` : simpleSizes[0];

            data.attributes.push(
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
                    options: ((product.saleWholesalePrice || product.wholesalePrice) / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
                },
            )
        }

        if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
            data.attributes.push({
                id: seasonAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: true,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
            data.attributes.push({
                id: in_categoryAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
            data.attributes.push({
                id: sexAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: true,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sizesGroupsAttr._id.toString()))
            data.attributes.push({
                id: sizesGroupsAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === sizesGroupsAttr._id.toString()).value
            });

        if (process.env.ENV !== 'dev' && product.image) {
            data.images = [{ src: product.image.url }];

            if (product.additionalImages) {
                for (const image of product.additionalImages)
                    data.images.push({ src: image.url });
            }
        }

        return data;
    }

    // If array of products is passed, return array. Else return product
    if (Array.isArray(products)) return await Promise.all(products.map(async product => await formatData(product, shop)));
    else return await formatData(products, shop);
}

async function generateRetailProductsData(products, shop) {
    const mongoAttributes = await ProductAttribute.find({});
    const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.find(el => el.woo_url == shop.url).id;
    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');
    const sizesGroupsAttr = mongoAttributes.find(m => m.slug == 'sizes_groups');

    async function formatData(product, shop) {
        const category = await Category.findById(product.category);

        const data = {
            name: product.name,
            slug: "p" + product.code,
            ...(product.sizes?.length === 0 && { // if simple product, manage stock. else this is set in the variations
                stock_quantity: product.quantity,
                "manage_stock": true, // enables the stock management
            }),
            type: product.sizes.length > 0 ? 'variable' : 'simple',
            // description: product.description,
            regular_price: product.retailPrice.toString(),
            sku: product.code,
            categories: [{ id: category.woocommerce.find(el => el.woo_url == shop.url).id }],
            attributes: [],
        }

        if (product?.woocommerce.length > 0 && product.woocommerce.find(el => el.woo_url == shop.url))
            data.id = product.woocommerce.find(el => el.woo_url == shop.url).id;

        // If not in live environment, set product status as private to not show it for clients
        if (process.env.ENV === 'dev') {
            data.status = 'private';
            data.catalog_visibility = 'hidden';
        }

        if (product.sizes.length > 0) {
            const simpleSizes = product.sizes.map(s => s.size);

            data.attributes.push(
                { // size
                    id: sizeId,
                    visible: true,
                    variation: true,
                    options: simpleSizes
                },
            )
        }

        if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
            data.attributes.push({
                id: seasonAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: true,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
            data.attributes.push({
                id: in_categoryAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
            data.attributes.push({
                id: sexAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: true,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sizesGroupsAttr._id.toString()))
            data.attributes.push({
                id: sizesGroupsAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === sizesGroupsAttr._id.toString()).value
            });

        if (process.env.ENV !== 'dev' && product.image) {
            data.images = [{ src: product.image.url }];

            if (product.additionalImages) {
                for (const image of product.additionalImages)
                    data.images.push({ src: image.url });
            }
        }

        return data;
    }

    // If array of products is passed, return array. Else return product
    if (Array.isArray(products)) return await Promise.all(products.map(async product => await formatData(product, shop)));
    else return await formatData(products, shop);
}

async function generateVariationsData(product, shop) {
    const sizeAttr = await ProductAttribute.findOne({ slug: 'size' });
    const sizeId = sizeAttr.woocommerce.find(el => el.woo_url == shop.url).id;

    const data = product.sizes.map(s => ({
        ...(s.woocommerce.length > 0 && { id: s.woocommerce.find(el => el.woo_url == shop.url).id }),
        "manage_stock": true,
        stock_quantity: s.quantity,
        regular_price: product.retailPrice.toString(),
        attributes: [{
            id: sizeId,
            option: s.size,
        }],
    }));

    return data;
}

async function generateSingleVariationData(product, size, shop) {
    const sizeAttr = await ProductAttribute.findOne({ slug: 'size' });
    const sizeId = sizeAttr.woocommerce.find(el => el.woo_url == shop.url).id;

    const data = {
        ...(size.woocommerce.length > 0 && { id: size.woocommerce.find(el => el.woo_url == shop.url).id }),
        "manage_stock": true,
        stock_quantity: size.quantity,
        regular_price: product.retailPrice.toString(),
        attributes: [{
            id: sizeId,
            option: size.size,
        }],
    };

    return data;
}

async function addWooDataToProduct(wooResponse, product, shop) {
    if (!product.woocommerce) product.woocommerce = [];
    product.woocommerce.push({
        woo_url: shop.url,
        id: wooResponse.id,
        permalink: wooResponse.permalink
    });

    await createWooVariations(wooResponse.id, product, shop);
}

async function createWooVariations(wooId, product, shop) {
    if (shop.custom.type === 'retail' && product.sizes.length > 0) {
        const sizeAttr = await ProductAttribute.findOne({ slug: 'size' });
        const sizeId = sizeAttr.woocommerce.find(el => el.woo_url == shop.url).id;
        // Create variations
        const variations = await generateVariationsData(product, shop);
        await shop.post(`products/${wooId}/variations/batch`, { create: variations }).then(async (response) => {
            for (let variation of response.data.create) {
                if (variation?.error) throw new Error(variation.error.message);
                const size = product.sizes.find(s => s.size.toLowerCase() === variation.attributes.find(a => a.id.toString() === sizeId).option.toLowerCase());
                if (!size) throw new Error(`Failed to find size for product ${product._id}! Looking for size: ${variation.attributes.find(a => a.id.toString() === sizeId).option}. Available sizes: ${product.sizes.map(s => s.size).join(', ')}`);
                if (!size.woocommerce) size.woocommerce = [];
                size.woocommerce.push({ id: variation.id, woo_url: shop.url });
            }
            console.log(`Created product variations in WooCommerce [${shop.url}] with _id: ${product._id}`);
        }).catch((error) => {
            console.error(`Failed to create product variation in WooCommerce [${shop.url}] with _id: ${product._id}`);
            console.error(error);
        });
    }
}

export async function WooCreateProduct(product) {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    console.log('Product changed from hidden to non-hidden -> Creating it in WooCommerce!');

    for (let shop of WooCommerce_Shops) {
        var data;
        if (shop.custom.type === 'wholesale') data = await generateWholesaleProductsData(JSON.parse(JSON.stringify(product)), shop);
        else if (shop.custom.type === 'retail') data = await generateRetailProductsData(JSON.parse(JSON.stringify(product)), shop);

        await shop.post("products", data).then(async (response) => {
            await addWooDataToProduct(response.data, product, shop);
            await product.save();
            console.log(`Product with id ${product._id} successfully created in WooCommerce [${shop.url}]!`);
        }).catch((error) => {
            console.error(`Failed to create product in WooCommerce [${shop.url}] with _id: ${product._id}`);
            console.error(error);
        });
    }
}

export async function WooEditProduct(product) {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    for (let shop of WooCommerce_Shops) {
        var data;
        if (shop.custom.type === 'wholesale') data = await generateWholesaleProductsData(product, shop);
        else if (shop.custom.type === 'retail') data = await generateRetailProductsData(product, shop);

        await shop.put(`products/${product.woocommerce.find(el => el.woo_url == shop.url).id}`, data).then(async () => {
            // If product has sizes

            if (shop.custom.type === 'retail' && product.sizes.length > 0) {
                // Get all variations ids
                const variationsInWoo = await shop.get(`products/${product.woocommerce.find(el => el.woo_url == shop.url).id}/variations`, {
                    per_page: 100
                }).then((response) => {
                    const ids = [];
                    response.data.forEach(el => ids.push(el.id));
                    return ids;
                });

                // Check if any size was delete in app (doesnt exist in woo) and delete it
                for (let size of variationsInWoo) {
                    if (product.sizes.find(s => s.woocommerce.find(el => el.woo_url == shop.url && el.id == size))) continue;
                    console.log(`Deleting product variation in WooCommerce [${shop.url}] for product with id: ${product._id}, variation id: ${size}`);
                    await shop.delete(`products/${product.woocommerce.find(el => el.woo_url == shop.url).id}/variations/${size}`, { force: true });
                }

                // Check if any size was created in app and create it in woo, or otherwise update it
                for (let size of product.sizes) {
                    if (!size.woocommerce?.find(el => el.woo_url == shop.url)) {
                        // create it
                        console.log(`Creating product variation in WooCommerce [${shop.url}] with _id: ${product._id} for size ${size.size}`);
                        await shop.post(`products/${product.woocommerce.find(el => el.woo_url == shop.url).id}/variations`, await generateSingleVariationData(product, size, shop)).then(async (response) => {
                            if (!size.woocommerce) size.woocommerce = [];
                            size.woocommerce.push({ id: response.data.id, woo_url: shop.url });
                            await product.save();
                        });
                    } else {
                        // update it
                        console.log(`Updating product variation in WooCommerce [${shop.url}] with _id: ${product._id} for size ${size.size}`);
                        await shop.put(`products/${product.woocommerce.find(el => el.woo_url == shop.url).id}/variations/${size.woocommerce.find(el => el.woo_url == shop.url).id}`, await generateSingleVariationData(product, size, shop));
                    }
                }
            }

            // Success
            console.log(`Product successfully edited in WooCommerce ${shop.url}!`)
        }).catch((error) => {
            // Invalid request, for 4xx and 5xx statuses
            console.error(`Failed to edit product in WooCommerce [${shop.url}] with _id: ${product._id}`);
            console.error(error);
        });
    }
}

export async function WooDeleteProduct(wooData, isProductReference) {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    // isProductReference is used in the edit page, in order to save the product in DB after edit
    const product = isProductReference ? wooData : { woocommerce: wooData };

    for (let shop of WooCommerce_Shops) {
        await shop.delete(`products/${product.woocommerce.find(el => el.woo_url == shop.url).id}`, {
            force: true
        }).then(async () => {
            // Success
            console.log(`Product successfully deleted in WooCommerce [${shop.url}]!`)
        }).catch((error) => {
            // Invalid request, for 4xx and 5xx statuses
            console.error(`Failed to delete product in WooCommerce [${shop.url}]`);
            console.error(error);
        });
    }

    if (!isProductReference) return;

    product.woocommerce = [];
    if (product.sizes.length > 0) {
        for (let size of product.sizes) {
            size.woocommerce = [];
        }
    }
    await product.save();
}

export async function WooCheckProductAttributesINIT() {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

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
        {
            name: 'Размери',
            slug: 'sizes_groups',
            order_by: 'name'
        }
    ];

    for (let shop of WooCommerce_Shops) {
        const mongoAttributes = await ProductAttribute.find({});
        const wooAttributes = await shop.get("products/attributes").then((response) => response.data);

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
            let wooId;
            if (!inWoo) {
                console.log(`Creating "${attribute.name}" in woo [${shop.url}]...`)
                // Create it in woo
                const wooAttribute = await shop.post("products/attributes", attribute).then((response) => response.data);

                wooId = wooAttribute.id;

                inMongo.woocommerce.push({ woo_url: shop.url, id: wooAttribute.id });
            } else wooId = inWoo.id;

            if (!inMongo.woocommerce.find(el => el.woo_url == shop.url))
                inMongo.woocommerce.push({ woo_url: shop.url, id: wooId });

            await inMongo.save();
        }
    }

    console.log("Products attributes check done!")
}

export async function WooUpdateQuantityProducts(products) {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p?.woocommerce?.length > 0 && p.deleted === false && p.hidden === false); // only find products that are in WooCommerce (some can be hidden)

    async function updateSimpleProducts(products, shop) {
        console.log('Starting update for ' + products.length + ' products...')
        for (let i = 0; i < products.length; i += 100) {
            const batch = products.slice(i, i + 100).map(p => ({ id: p.woocommerce.find(el => el.woo_url == shop.url).id, stock_quantity: p.quantity }));
            console.log('Starting work on simple products batch: ' + i)
            await shop.post('products/batch', { update: batch }).then(() => {
                console.log(`Products quantity successfully updated in WooCommerce [${shop.url}]!`)
            }).catch((error) => {
                console.error(`Error batch updating products quantity in WooCommerce [${shop.url}]!`)
                console.error(error);
            });
        }
    }

    for (let shop of WooCommerce_Shops) {
        if (shop.custom.type === 'wholesale') {
            // All products are simple
            await updateSimpleProducts(filtered, shop);
        } else if (shop.custom.type === 'retail') {
            // Split to simple and variable products
            const simple = filtered.filter(p => p.sizes.length === 0);
            const variable = filtered.filter(p => p.sizes.length > 0);

            // Do it in batches of 100

            // Simple products
            await updateSimpleProducts(simple, shop);

            // Variable products (have to be done one by one)
            for (let product of variable) {
                let variations = [];
                for (let size of product.sizes)
                    variations.push({ id: size.woocommerce.find(el => el.woo_url == shop.url).id, stock_quantity: size.quantity });

                await shop.post(`products/${product.woocommerce.find(el => el.woo_url == shop.url).id}/variations/batch`, { update: variations }).then(async () => {
                    console.log(`Products variations for product id ${product.woocommerce.find(el => el.woo_url == shop.url).id} quantity successfully updated in WooCommerce [${shop.url}]!`)
                }).catch((error) => {
                    console.error(`Failed to update product variations quantity in WooCommerce [${shop.url}] with _id: ${product._id}`);
                    console.error(product);
                    console.error(error);
                });
            }
        }
    }
}

export async function WooUpdateSaleWholesalePriceProducts(products) {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p?.woocommerce?.length > 0 && p.deleted === false && p.hidden === false); // only find products that are in WooCommerce (some can be hidden)

    for (let shop of WooCommerce_Shops) {
        if (shop.custom.type !== 'wholesale') continue;

        console.log('Starting update for ' + filtered.length + ' products...')
        for (let i = 0; i < filtered.length; i += 100) {
            const batch = filtered.slice(i, i + 100).map(p => ({ id: p.woocommerce.find(el => el.woo_url == shop.url).id, sale_price: p?.saleWholesalePrice || "" }));
            console.log('Starting work on simple products batch: ' + i)
            await shop.post('products/batch', { update: batch }).then(() => {
                console.log(`Products sale price successfully updated in WooCommerce [${shop.url}]!`)
            }).catch((error) => {
                console.error(`Error batch updating products sale price in WooCommerce [${shop.url}]!`)
                console.error(error);
            });
        }
    }
}

export async function tempWooUpdateAttributes(products) {
    //FIXME DELETE THIS FUNCTINO WHEN DELETING /products/temp ROUTE
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p?.woocommerce?.length > 0 && p.deleted === false && p.hidden === false); // only find products that are in WooCommerce (some can be hidden)
    const shop = WooCommerce_Shops[0];

    const mongoAttributes = await ProductAttribute.find({});
    const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.find(el => el.woo_url == shop.url).id;
    const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.find(el => el.woo_url == shop.url).id;
    const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.find(el => el.woo_url == shop.url).id;
    const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.find(el => el.woo_url == shop.url).id;
    const seasonAttr = mongoAttributes.find(m => m.slug == 'season');
    const in_categoryAttr = mongoAttributes.find(m => m.slug == 'in_category');
    const sexAttr = mongoAttributes.find(m => m.slug == 'sex');
    const sizesGroupsAttr = mongoAttributes.find(m => m.slug == 'sizes_groups');

    function formatData(product, shop) {
        const data = {
            attributes: [],
        }

        if (product?.woocommerce.length > 0 && product.woocommerce.find(el => el.woo_url == shop.url))
            data.id = product.woocommerce.find(el => el.woo_url == shop.url).id;

        if (product.sizes.length > 0) {
            const simpleSizes = product.sizes.map(s => s.size);
            const viberSizes = simpleSizes.length > 1 ? `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}` : simpleSizes[0];

            data.attributes.push(
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
                    options: ((product.saleWholesalePrice || product.wholesalePrice) / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
                },
            )
        }

        if (product.attributes?.find(a => a.attribute.toString() === seasonAttr._id.toString()))
            data.attributes.push({
                id: seasonAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: true,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === seasonAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === in_categoryAttr._id.toString()))
            data.attributes.push({
                id: in_categoryAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === in_categoryAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sexAttr._id.toString()))
            data.attributes.push({
                id: sexAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: true,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === sexAttr._id.toString()).value
            });

        if (product.attributes?.find(a => a.attribute.toString() === sizesGroupsAttr._id.toString()))
            data.attributes.push({
                id: sizesGroupsAttr.woocommerce.find(el => el.woo_url == shop.url).id,
                visible: false,
                variation: false,
                options: product.attributes.find(a => a.attribute.toString() === sizesGroupsAttr._id.toString()).value
            });

        return data;
    }

    const fixedProducts = filtered.map(p => formatData(p, WooCommerce_Shops[0]));

    console.log('Starting update for ' + fixedProducts.length + ' products...')
    for (let i = 0; i < fixedProducts.length; i += 100) {
        const batch = fixedProducts.slice(i, i + 100);
        console.log('Starting work on simple products batch: ' + i)
        await WooCommerce_Shops[0].post('products/batch', { update: batch }).then((res) => {
            console.log('Products attributes successfully updated in WooCommerce!')
        }).catch((error) => {
            console.error('Error batch updating products attributes in WooCommerce!')
            console.error(error);
        });
    }
}

export async function WooCreateProductsINIT() {
    if (WooCommerce_Shops.length === 0) return; // If woocommerce wasnt initalized or is not used
    //FIXME
    for (let shop of [WooCommerce_Shops[1]]) {
        // for (let shop of WooCommerce_Shops) {
        console.log(`Starting products init for WooCommerce [${shop.url}]...`);
        var data;

        const products = await Product.find({ "woocommerce": { $exists: true }, "woocommerce.woo_url": { $ne: shop.url }, hidden: false, deleted: false }).sort({ _id: -1 });

        return console.log(products[products.length - 1]);
        if (shop.custom.type === 'wholesale') data = await generateWholesaleProductsData([...products], shop);
        else if (shop.custom.type === 'retail') data = await generateRetailProductsData([...products], shop);

        if (data.length === 0) {
            console.log(`No products need to be created for WooCommerce [${shop.url}].`);
            continue;
        }

        console.log(`Found ${data.length} products to create in WooCommerce [${shop.url}]. Starting...`);
        // Batch accepts max 100 products per request
        for (let i = 0; i < data.length; i += 100) {
            console.log(`Starting on batch ${i} through ${i + 100}...`)
            const batch = data.slice(i, i + 100);

            await shop.post("products/batch", { create: batch }).then(async (response) => {
                const productsToSave = [];

                for (let wooResponse of response.data.create) {
                    if (wooResponse.error) {
                        console.error(wooResponse);
                        throw new Error(`Error creating product in WooCommerce [${shop.url}]: ${wooResponse.error.message}`);
                    }
                    const productInDb = products.find(p => p.code === wooResponse.sku);
                    await addWooDataToProduct(wooResponse, productInDb, shop);
                    productsToSave.push(productInDb);
                }

                await Promise.all(productsToSave.map(async (p) => await p.save()));
                console.log(`Product batch ${i} successfully created in WooCommerce!`)
            }).catch((error) => {
                console.error(error);
            });
        }

        console.log(`All products successfully created in WooCommerce [${shop.url}]!`);
    }
}

async function updateAllProductsQuantities() {
    const products = await Product.find({ hidden: false, deleted: false }).sort({ _id: -1 });

    console.log('Starting update for ' + products.length + ' products...')
    await WooUpdateQuantityProducts(products);
    console.log('All products quantity successfully updated in WooCommerce!');
}
// updateAllProductsQuantities();


// TODO
/* BELOW FUNCTIONS NOT YET DONE FOR MULTI WOO STORES AND RETAIL */
/*
export async function WooCreateProductsBatch(products) {
    const doneProducts = await generateWholesaleProductsData(JSON.parse(JSON.stringify(products)));

    if (doneProducts.length > 0) {
        // Batch accepts max 100 products per request
        for (let i = 0; i < doneProducts.length; i += 100) {
            const productsToSave = [];
            const batch = doneProducts.slice(i, i + 100);
            await WooCommerce.post("products/batch", { create: batch }).then(async (response) => {
                // Success
                for (let product of response.data.create) {
                    if (product?.error) return console.error(product.error);
                    const productInDb = products.find(p => p.code === product.sku);
                    console.log({ product, productInDb })

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
    const doneProducts = await generateWholesaleProductsData(JSON.parse(JSON.stringify(products)));

    if (doneProducts.length > 0) {
        // Batch accepts max 100 products per request
        console.log(doneProducts.length)
        for (let i = 0; i < doneProducts.length; i += 20) {
            const batch = doneProducts.slice(i, i + 20);
            console.log(`Starting update on batch ${i}...`)
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

export async function checkProductsInWoo() {
    // This function compares the quantity and price of the products in the database with the woocommerce store to see if there are any changes and update woocommerce accordingly
    if (WooCommerce_Shops?.length === 0) return;
    // Get all products from woo
    let done = false;
    let offset = 0;
    const filter = { hidden: { $ne: true }, deleted: { $ne: true } };
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

    // Save to file
    fs.writeFileSync('server/woocommerce/wooProducts.json', JSON.stringify(wooProducts));
    return;
    const appProducts = await Product.find(filter);
    var wooProducts = fs.readFileSync('server/woocommerce/wooProducts.json', 'utf8');
    wooProducts = JSON.parse(wooProducts);

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
    // console.log(productsToUpdate.map(p => p._id).join(', '));
    await WooEditProductsBatch(productsToUpdate);
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
 */
// checkProductsInWoo();