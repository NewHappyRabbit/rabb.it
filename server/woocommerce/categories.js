import { WooCommerce } from "../config/woocommerce.js";
import { Category } from "../models/category.js";

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
        data.image = { src: `${process.env.URL}${category.image}` };

    WooCommerce.post("products/categories", data).then((response) => {
        // Success
        console.log("Category successfully created in WooCommerce!")
        // add woo id to category
        category.woocommerce.id = response.data.id;
        category.save();
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
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
        data.image = { src: `${process.env.URL}${category.image}` };

    WooCommerce.put(`products/categories/${category.woocommerce.id}`, data).then(() => {
        // Success
        console.log('Category successfully edited in WooCommerce!')
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}

export async function WooDeleteCategory(wooId) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    WooCommerce.delete(`products/categories/${wooId}`, {
        force: true
    }).then(() => {
        // Success
        console.log('Category successfully deleted in WooCommerce!')
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}