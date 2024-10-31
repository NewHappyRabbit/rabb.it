import { WooCommerce } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
import { retry } from "./common.js";

export async function WooCreateCategoriesINIT() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const categories = await Category.find({});

    for (const category of categories) {
        WooCreateCategory(category);
    }

    console.log("Categories successfully created in WooCommerce!")
}

export async function WooCreateCategory(category) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const data = {
        name: category.name,
        slug: category.slug,
        menu_order: category.order
    }

    if (category.path) {
        const parentSlug = category.path.split(',').filter(el => el != '').slice(-1)[0];
        const parent = await Category.findOne({ slug: parentSlug });
        if (parent) data.parent = parent.woocommerce.id;
    }

    if (process.env.ENV !== 'dev' && category.image)
        data.image = { src: category.image.url };

    retry(async () => {
        const response = await WooCommerce.post("products/categories", data)
        console.log("Category successfully created in WooCommerce!")
        //TODO TEST
        // add woo id to category
        category.woocommerce.id = response.data.id;
        category.save();
    });
}

export async function WooEditCategory(category) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const data = {
        name: category.name,
        slug: category.slug,
        menu_order: category.order
    }

    if (category.path) {
        const parentSlug = category.path.split(',').filter(el => el != '').slice(-1)[0];
        const parent = await Category.findOne({ slug: parentSlug });
        if (parent) data.parent = parent.woocommerce.id;
    }

    if (process.env.ENV !== 'dev' && category.image)
        data.image = { src: category.image.url };

    retry(async () => {
        await WooCommerce.put(`products/categories/${category.woocommerce.id}`, data)
        console.log('Category successfully edited in WooCommerce!')
    });
}

export async function WooDeleteCategory(wooId) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    retry(async () => {
        await WooCommerce.delete(`products/categories/${wooId}`, {
            force: true
        });
        console.log('Category successfully deleted in WooCommerce!')
    });
}