import { WooCommerce_Shops } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
import { retry } from "./common.js";

export async function WooCreateCategoriesINIT() {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used
    console.log('Starting WOO categories init...')
    const unsorted = await Category.find();
    const sorted = [];

    unsorted.filter(cat => !cat.path).forEach(cat => {
        sorted.push(cat);
    });

    for (let i = 0; i < 9; i++) {
        unsorted.filter(cat => cat.path?.split(',').length == i + 1).forEach(cat => {
            sorted.push(cat);
        });
    }

    for (let shop of WooCommerce_Shops) {
        for (let category of sorted) {
            if (category.woocommerce.find(el => el.woo_url == shop.url)) continue;

            const data = {
                name: category.name,
                slug: category.slug,
                menu_order: category.order
            }
            await checkParentId({ data, category, shop });

            const response = await shop.post("products/categories", data)
            category.woocommerce.push({
                woo_url: shop.url,
                id: response.data.id,
            });
            await category.save();
        }
    }
    console.log("Categories successfully created in WooCommerce!")
}

async function checkParentId({ data, category, shop }) {
    if (category.path) {
        const parentSlug = category.path.split(',').filter(el => el != '').slice(-1)[0];
        const parent = await Category.findOne({ slug: parentSlug });
        if (parent) data.parent = parent.woocommerce?.find(el => el.woo_url == shop.url).id;
    } else data.parent = null;
}

export async function WooCreateCategory(category) {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    const data = {
        name: category.name,
        slug: category.slug,
        menu_order: category.order
    }

    if (process.env.ENV !== 'dev' && category.image)
        data.image = { src: category.image.url };

    for (let shop of WooCommerce_Shops) {
        await checkParentId({ data, category, shop });

        await retry(async () => {
            const response = await shop.post("products/categories", data)
            console.log(`Category successfully created in WooCommerce [${shop.url}]!`)
            category.woocommerce.push({
                woo_url: shop.url,
                id: response.data.id,
            });

            await category.save();
        });
    }
}

export async function WooEditCategory(category) {
    if (WooCommerce_Shops?.length === 0 || !category.woocommerce?.length) return; // If woocommerce wasnt initalized or is not used

    const data = {
        name: category.name,
        slug: category.slug,
        menu_order: category.order
    }

    if (process.env.ENV !== 'dev' && category.image)
        data.image = { src: category.image.url };

    for (let shop of WooCommerce_Shops) {
        const categoryId = category.woocommerce.find(el => el.woo_url == shop.url).id;

        await checkParentId({ data, category, shop });

        await retry(async () => {
            await shop.put(`products/categories/${categoryId}`, data)
            console.log(`Category successfully edited in WooCommerce [${shop.url}]!`)
        });
    }
}

export async function WooDeleteCategory(wooData) {
    if (WooCommerce_Shops?.length === 0 || !wooData) return; // If woocommerce wasnt initalized or is not used

    for (let shop of WooCommerce_Shops) {
        const categoryId = wooData.find(el => el.woo_url == shop.url).id;

        await retry(async () => {
            await shop.delete(`products/categories/${categoryId}`, {
                force: true
            });
            console.log(`Category successfully deleted in WooCommerce! [${shop.url}]`)
        });
    }
}