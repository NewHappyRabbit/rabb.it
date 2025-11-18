// This file contains developer functions that can be run on demand.
import { WooCommerce_Shops } from "../../config/woocommerce.js";
import { Product } from "../../models/product.js";
import fs from "fs";
import { WooCreateProduct, WooUpdateQuantityProducts } from "../products.js";
import PQueue from "p-queue";
import { MultiBar, Presets } from 'cli-progress';

async function findAndDeleteHidden() {
    // This function looks for products that are marked as hidden in our database and checks if they exist in WooCommerce.
    // If they do, it deletes them from WooCommerce.
    if (WooCommerce_Shops.length === 0) {
        console.log("No WooCommerce shops configured.");
        return;
    }

    const hiddenProducts = await Product.find({ hidden: true });

    console.log(`Found ${hiddenProducts.length} hidden products, looking for them in WooCommerce...`);

    for (let shop of WooCommerce_Shops) {
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

async function syncWoo() {
    // This function takes the results from compareAllProducts() and performs the necessary actions in WooCommerce to sync the products.
    // It reads the files created by compareAllProducts() and performs the necessary actions in WooCommerce.

    // FIRST RUN compareAllProducts() TO GENERATE THE FILES!
    if (WooCommerce_Shops.length === 0) {
        console.log("No WooCommerce shops configured.");
        return;
    }
    console.log("Starting WooCommerce sync...");

    const multibar = new MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {percentage}% | {value}/{total} Products to {action} | Shop: {shop}'
    }, Presets.shades_classic);

    const tasks = [];

    async function syncShopProducts(shop, i, deleteBar, updateBar, createBar) {
        const productsToDeletePath = `server/woocommerce/dev/results/productsToDelete_shop_${i}.json`;
        const productsQtyToUpdatePath = `server/woocommerce/dev/results/productsQtyToUpdate_shop_${i}.json`;
        const productsToCreatePath = `server/woocommerce/dev/results/productsToCreate_shop_${i}.json`;

        const productsToDelete = fs.existsSync(productsToDeletePath) ? JSON.parse(fs.readFileSync(productsToDeletePath)) : [];
        const productsQtyToUpdate = fs.existsSync(productsQtyToUpdatePath) ? JSON.parse(fs.readFileSync(productsQtyToUpdatePath)) : [];
        const productsToCreate = fs.existsSync(productsToCreatePath) ? JSON.parse(fs.readFileSync(productsToCreatePath)) : [];

        if (productsToDelete.length > 0) {
            deleteBar.setTotal(productsToDelete.length);
            let errorDelete = false;
            // Batch accepts max 100 products per request
            for (let i = 0; i < productsToDelete.length; i += 100) {
                const batch = productsToDelete.slice(i, i + 100).map(p => p.id);
                await shop.post("products/batch", { delete: batch }).then(async () => {
                    // Success
                    // delete batch from productsToDelete array and resave file (in case the process crashes, we can continue later)
                    productsToDelete.splice(0, batch.length);
                    fs.writeFileSync(productsToDeletePath, JSON.stringify(productsToDelete));
                    deleteBar.update(i + batch.length);
                }).catch((error) => {
                    console.error('Failed to delete product batch in WooCommerce!');
                    console.error(error);
                    errorDelete = true;
                });
            }

            if (!errorDelete) {
                fs.unlink(productsToDeletePath, (err) => {
                    if (err) console.error(`Error deleting file ${productsToDeletePath}:`, err);
                });
            } else {
                console.log('Product deletion encountered errors. Please check the logs and re-run syncWoo() to continue.');
            }
        } else deleteBar.setTotal(0);

        if (productsQtyToUpdate.length > 0) {
            // Get fresh products from DB to make sure we have the latest quantity
            const freshProducts = await Product.find({ _id: { $in: productsQtyToUpdate.map(p => p._id) } });

            //TODO: Handle errors and partial updates
            await WooUpdateQuantityProducts(freshProducts, shop, updateBar);

            fs.unlink(productsQtyToUpdatePath, (err) => {
                if (err) console.error(`Error deleting file ${productsQtyToUpdatePath}:`, err);
            });
        } else updateBar.setTotal(0);

        if (productsToCreate.length > 0) {
            createBar.setTotal(productsToCreate.length);

            // Get fresh products from DB to make sure we have the latest data
            const freshProducts = await Product.find({ _id: { $in: productsToCreate.map(p => p._id) } });

            for (let product of freshProducts) {
                // Check if woo_url exists in the product and sizes and delete it (its not correct or product no longer exists in woo)
                product.woocommerce = product.woocommerce.filter(w => w.woo_url !== shop.url);
                if (product.sizes && product.sizes.length > 0) {
                    for (let size of product.sizes) {
                        size.woocommerce = size.woocommerce.filter(w => w.woo_url !== shop.url);
                    }
                }

                await WooCreateProduct(product, shop);

                createBar.increment();
                // Remove product from array and resave file (in case the process crashes, we can continue later)
                productsToCreate.shift();
                fs.writeFileSync(productsToCreatePath, JSON.stringify(productsToCreate));
            }
            fs.unlink(productsToCreatePath, (err) => {
                if (err) console.error(`Error deleting file ${productsToCreatePath}:`, err);
            });
        } else createBar.setTotal(0);

        return true;
    }

    for (let shop of WooCommerce_Shops) {
        const deleteBar = multibar.create(1, 0, { shop: shop.url, action: 'delete' });
        const createBar = multibar.create(1, 0, { shop: shop.url, action: 'create' });
        const updateBar = multibar.create(1, 0, { shop: shop.url, action: 'update' });
        tasks.push(syncShopProducts(shop, WooCommerce_Shops.indexOf(shop), deleteBar, updateBar, createBar));
    }

    await Promise.all(tasks);

    multibar.stop();
    console.log("WooCommerce sync completed.")
}

async function compareAllProducts() {
    // This function compares all products in our database with those in WooCommerce and logs any discrepancies. For example, non-existing products in WooCommerce, quantity mismatches, etc.

    // Run createSnapshots() before running this function!

    const tasks = [];

    const multibar = new MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {percentage}% | {value}/{total} {productType} Products | Shop: {shop}'
    }, Presets.shades_classic);

    let i = 0;
    for (let shop of WooCommerce_Shops) {
        const wooProducts = JSON.parse(fs.readFileSync(`server/woocommerce/dev/results/shop_${i}_wooProducts.json`));
        const dbProducts = JSON.parse(fs.readFileSync(`server/woocommerce/dev/results/dbProducts.json`));
        const barWoo = multibar.create(wooProducts.length, 0, { shop: shop.url, productType: 'Woo' });
        const barDb = multibar.create(dbProducts.length, 0, { shop: shop.url, productType: 'DB' });
        tasks.push(compareProducts(wooProducts, dbProducts, shop, barWoo, barDb, i));
        i++;
    }



    async function compareProducts(wooProducts, dbProducts, shop, barWoo, barDb, i) {
        if (!wooProducts || !dbProducts) {
            console.log(`No products found for shop: ${shop.url}. Make sure to run createSnapshots() first.`);
            return true;
        }

        const productsToDelete = [];
        const productsToCreate = [];
        const productsQtyToUpdate = [];

        const queue = new PQueue({ concurrency: 3 });

        for (let wooProduct of wooProducts) {
            // Check if any product exists in WooCommerce but not in DB. If it does, delete it from WooCommerce.
            const wooId = wooProduct.id.toString();
            const dbProduct = dbProducts.find(p => p.woocommerce.find(w => w.woo_url === shop.url)?.id.toString() === wooId);

            if (!dbProduct) {
                productsToDelete.push(wooProduct);
                continue;
            }

            // Check if quantity doesnt match
            if (wooProduct.type === 'simple' && dbProduct.quantity !== wooProduct.stock_quantity) {
                productsQtyToUpdate.push(dbProduct);
                barWoo.increment();
            } else if (wooProduct.type === 'variable') {
                // Check each variation quantity
                queue.add(async () => {
                    const req = await shop.get(`products/${wooId}/variations`, { per_page: 100 });
                    const variations = req.data;
                    variations.forEach(async (variation) => {
                        if (variation.stock_quantity !== dbProduct.sizes.find(s => s.woocommerce.find(w => w.woo_url === shop.url)?.id.toString() === variation.id.toString())?.quantity) {
                            productsQtyToUpdate.push(dbProduct);
                        }
                    });
                    barWoo.increment();
                });
            }
        }

        await queue.onIdle();

        for (let dbProduct of dbProducts) {
            barDb.increment();
            // Check if any product exists in DB but not in WooCommerce. If it does, create it in WooCommerce.
            const wooId = dbProduct.woocommerce.find(w => w.woo_url === shop.url)?.id.toString();
            const wooProduct = wooProducts.find(p => p.id.toString() === wooId);

            if (!wooProduct) {
                productsToCreate.push(dbProduct);
                continue;
            }
        }

        const productsToDeletePath = `server/woocommerce/dev/results/productsToDelete_shop_${i}.json`;
        const productsQtyToUpdatePath = `server/woocommerce/dev/results/productsQtyToUpdate_shop_${i}.json`;
        const productsToCreatePath = `server/woocommerce/dev/results/productsToCreate_shop_${i}.json`;

        if (productsToDelete.length > 0) {
            console.log(`Found ${productsToDelete.length} products in WooCommerce ${shop.url} that do not exist in DB. Will be deleted.`);
            fs.writeFileSync(productsToDeletePath, JSON.stringify(productsToDelete));
        } else {
            console.log(`No products to delete in WooCommerce for shop: ${shop.url}`);
            if (fs.existsSync(productsToDeletePath)) {
                fs.unlinkSync(productsToDeletePath);
            }
        }

        if (productsQtyToUpdate.length > 0) {
            console.log(`Found ${productsQtyToUpdate.length} products in WooCommerce ${shop.url} that need updating. Will be updated.`);
            fs.writeFileSync(productsQtyToUpdatePath, JSON.stringify(productsQtyToUpdate));
        } else {
            console.log(`No products to update in WooCommerce for shop: ${shop.url}`);
            if (fs.existsSync(productsQtyToUpdatePath)) {
                fs.unlinkSync(productsQtyToUpdatePath);
            }
        }

        if (productsToCreate.length > 0) {
            console.log(`Found ${productsToCreate.length} products in DB that do not exist in WooCommerce ${shop.url}. Will be created.`);
            fs.writeFileSync(productsToCreatePath, JSON.stringify(productsToCreate));
        } else {
            console.log(`No products to create in WooCommerce for shop: ${shop.url}`);
            if (fs.existsSync(productsToCreatePath)) {
                fs.unlinkSync(productsToCreatePath);
            }
        }

        return true;
    }

    await Promise.all(tasks);
    multibar.stop();

    console.log('All comparisons completed. Review the logs for details.');
}

async function createSnapshots() {
    // This functions saves all products from all WooCommerce shops and the DB to local files for later comparison.
    // Use this function before running any bulk comparisons

    if (WooCommerce_Shops.length === 0) {
        console.log("No WooCommerce shops configured.");
        return;
    }

    console.log('Getting products from DB...');

    const dbProducts = await Product.find({ deleted: false, hidden: false });
    fs.writeFileSync(`server/woocommerce/dev/results/dbProducts.json`, JSON.stringify(dbProducts));
    console.log(`Saved ${dbProducts.length} products from DB to dbProducts.json`);

    const multibar = new MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {percentage}% | {value}/{total} Products | Shop: {shop}'
    }, Presets.shades_classic);

    const tasks = [];

    async function getProductsFromShop(shop, i, bar) {
        let done = false;
        let offset = 0;
        const wooProducts = [];

        while (done == false) {
            if (offset + 100 > dbProducts.length)
                bar.setTotal(offset + 100);

            const req = await shop.get("products", { per_page: 100, offset, orderby: 'id' });
            const products = req.data;
            if (products.length < 100) done = true;

            wooProducts.push(...products);

            offset += 100;
            bar.update(wooProducts.length);
        }

        bar.setTotal(wooProducts.length);
        bar.update(wooProducts.length);

        // Save to file
        fs.writeFileSync(`server/woocommerce/dev/results/shop_${i}_wooProducts.json`, JSON.stringify(wooProducts));
        return true;
    }

    let i = 0;
    for (let shop of WooCommerce_Shops) {
        const bar = multibar.create(dbProducts.length, 0, { shop: shop.url });
        tasks.push(getProductsFromShop(shop, i, bar));
        i++;
    }

    await Promise.all(tasks);
    multibar.stop();
    console.log('Snapshots created. You can now run compareAllProducts() to compare the data.');
}

async function fullySyncProducts() {
    // This function creates a snapshot of all products in the DB and WooCommerce, compares them and performs the necessary actions to fully sync them.
    // await createSnapshots();
    // await compareAllProducts();
    await syncWoo();
}
fullySyncProducts();