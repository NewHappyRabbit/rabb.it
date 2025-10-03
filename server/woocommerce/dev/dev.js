// This file contains developer functions that can be run on demand.
import { WooCommerce_Shops } from "../../config/woocommerce.js";
import { Product } from "../../models/product.js";
import fs from "fs";
import { WooCreateProduct, WooUpdateQuantityProducts } from "../products.js";

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

    for (let i = 0; i < WooCommerce_Shops.length; i++) {
        const shop = WooCommerce_Shops[i];
        console.log(`----------------------------------------`);
        console.log(`Syncing products for shop: ${shop.url}`);

        const productsToDeletePath = `server/woocommerce/dev/results/productsToDelete_shop_${i}.json`;
        const productsQtyToUpdatePath = `server/woocommerce/dev/results/productsQtyToUpdate_shop_${i}.json`;
        const productsToCreatePath = `server/woocommerce/dev/results/productsToCreate_shop_${i}.json`;

        const productsToDelete = fs.existsSync(productsToDeletePath) ? JSON.parse(fs.readFileSync(productsToDeletePath)) : [];
        const productsQtyToUpdate = fs.existsSync(productsQtyToUpdatePath) ? JSON.parse(fs.readFileSync(productsQtyToUpdatePath)) : [];
        const productsToCreate = fs.existsSync(productsToCreatePath) ? JSON.parse(fs.readFileSync(productsToCreatePath)) : [];

        if (productsToDelete.length > 0) {
            console.log(`Deleting ${productsToDelete.length} products in WooCommerce...`);

            await shop.post('products/batch', {
                delete: productsToDelete.map(p => p.id)
            }).then(() => {
                fs.unlink(productsToDeletePath, (err) => {
                    console.log('Product deletion completed.');
                    if (err) console.error(`Error deleting file ${productsToDeletePath}:`, err);
                });
            })
                .catch((error) => {
                    console.error(`Error deleting products: `, error.response.data);
                });;
        } else console.log(`No products to delete.`);

        if (productsQtyToUpdate.length > 0) {
            console.log(`Starting quantity update for ${productsQtyToUpdate.length} products in WooCommerce [${shop.url}]...`);

            // Get fresh products from DB to make sure we have the latest quantity
            const freshProducts = await Product.find({ _id: { $in: productsQtyToUpdate.map(p => p._id) } });

            await WooUpdateQuantityProducts(freshProducts, shop);

            console.log(`Quantity update completed.`);
            fs.unlink(productsQtyToUpdatePath, (err) => {
                if (err) console.error(`Error deleting file ${productsQtyToUpdatePath}:`, err);
            });
        } else console.log(`No products to update.`);

        if (productsToCreate.length > 0) {
            console.log(`Creating ${productsToCreate.length} products in WooCommerce...`);

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

                // Remove product from array and resave file (in case the process crashes, we can continue later)
                productsToCreate.shift();
                fs.writeFileSync(productsToCreatePath, JSON.stringify(productsToCreate));
            }
            console.log(`Products creation completed.`);
            fs.unlink(productsToCreatePath, (err) => {
                if (err) console.error(`Error deleting file ${productsToCreatePath}:`, err);
            });
        } else console.log(`No products to create.`);
    }

    console.log("-----------------------------------------");
    console.log("WooCommerce sync completed.")
}

async function compareAllProducts() {
    // This function compares all products in our database with those in WooCommerce and logs any discrepancies. For example, non-existing products in WooCommerce, quantity mismatches, etc.

    // Run createSnapshots() before running this function!

    for (let i = 0; i < WooCommerce_Shops.length; i++) {
        const shop = WooCommerce_Shops[i];
        console.log(`----------------------------------------`);
        console.log(`Comparing products for shop: ${shop.url}`);
        const wooProducts = JSON.parse(fs.readFileSync(`server/woocommerce/dev/results/shop_${i}_wooProducts.json`));
        const dbProducts = JSON.parse(fs.readFileSync(`server/woocommerce/dev/results/dbProducts.json`));

        console.log('Woo Products total: ' + wooProducts.length);
        console.log('DB Products total: ' + dbProducts.length)

        if (!wooProducts || !dbProducts) {
            console.log(`No products found for shop: ${shop.url}. Make sure to run createSnapshots() first.`);
            continue;
        }

        const productsToDelete = [];
        const productsToCreate = [];
        const productsQtyToUpdate = [];

        for (let wooProduct of wooProducts) {
            // Check if any product exists in WooCommerce but not in DB. If it does, delete it from WooCommerce.
            const wooId = wooProduct.id.toString();
            const dbProduct = dbProducts.find(p => p.woocommerce.find(w => w.woo_url === shop.url).id.toString() === wooId);

            if (!dbProduct) {
                productsToDelete.push(wooProduct);
                continue;
            }

            // Check if quantity doesnt match
            if (wooProduct.type === 'simple' && dbProduct.quantity !== wooProduct.stock_quantity) {
                productsQtyToUpdate.push(dbProduct);
            } else if (wooProduct.type === 'variable') {
                // Check each variation quantity
                // TODO
            }
        }

        for (let dbProduct of dbProducts) {
            // Check if any product exists in DB but not in WooCommerce. If it does, create it in WooCommerce.
            const wooId = dbProduct.woocommerce.find(w => w.woo_url === shop.url).id.toString();
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
            console.log(`Found ${productsToDelete.length} products in WooCommerce that do not exist in DB.`);
            fs.writeFileSync(productsToDeletePath, JSON.stringify(productsToDelete));
            //TODO
        } else {
            console.log(`No products to delete in WooCommerce for shop: ${shop.url}`);
            if (fs.existsSync(productsToDeletePath)) {
                fs.unlinkSync(productsToDeletePath);
            }
        }

        if (productsQtyToUpdate.length > 0) {
            console.log(`Found ${productsQtyToUpdate.length} products in WooCommerce that need updating.`);
            fs.writeFileSync(productsQtyToUpdatePath, JSON.stringify(productsQtyToUpdate));
            //TODO
            // Instead of using the products in the array, grab them from the DB directly, because the qty may be different
        } else {
            console.log(`No products to update in WooCommerce for shop: ${shop.url}`);
            if (fs.existsSync(productsQtyToUpdatePath)) {
                fs.unlinkSync(productsQtyToUpdatePath);
            }
        }

        if (productsToCreate.length > 0) {
            console.log(`Found ${productsToCreate.length} products in DB that do not exist in WooCommerce.`);
            fs.writeFileSync(productsToCreatePath, JSON.stringify(productsToCreate));
            //TODO
        } else {
            console.log(`No products to create in WooCommerce for shop: ${shop.url}`);
            if (fs.existsSync(productsToCreatePath)) {
                fs.unlinkSync(productsToCreatePath);
            }
        }

        console.log(`----------------------------------------`);
    }

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

    let i = 0;
    for (let shop of WooCommerce_Shops) {
        let done = false;
        let offset = 0;
        const wooProducts = [];

        console.log(`Starting WooCommerce products batch get for shop: ${shop.url}`);
        while (done == false) {
            const req = await shop.get("products", { per_page: 100, offset, orderby: 'id' });
            const products = req.data;
            if (products.length < 100) done = true;

            wooProducts.push(...products);

            offset += 100;
            console.log(`Got ${wooProducts.length} products from WooCommerce. Attempting to get more...`);
        }

        // Save to file
        fs.writeFileSync(`server/woocommerce/dev/results/shop_${i}_wooProducts.json`, JSON.stringify(wooProducts));
        console.log(`Saved ${wooProducts.length} products from WooCommerce to wooProducts.json`);

        i++;
    }

    console.log('Snapshots created. You can now run compareAllProducts() to compare the data.');
}

async function fullySyncProducts() {
    // This function creates a snapshot of all products in the DB and WooCommerce, compares them and performs the necessary actions to fully sync them.
    await createSnapshots();
    await compareAllProducts();
    await syncWoo();
}