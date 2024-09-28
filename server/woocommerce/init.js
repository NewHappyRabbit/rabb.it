import { WooCommerce } from "../config/woocommerce.js";
import { Product } from "../models/product.js";
import { WooCreateCategoriesINIT } from "./categories.js";
import { WooCheckProductAttributesINIT, WooCreateProductsINIT } from "./products.js";

export async function FirstInitWooCommerce() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    console.log("Starting WooCommerce initialization...")

    // Check if all products attributes exist in WooCommerce, if not - create them
    // WooCheckProductAttributesINIT();
    // WooCreateCategoriesINIT();
    // Delete old products
    /* await WooCommerce.get("products?fields=id", { per_page: 100 }).then(async (response) => {
        const products = response.data;

        await WooCommerce.post("products/batch", { delete: products.map(p => p.id) }).then(async (response) => {
            // Success
            console.log(response);
            console.log("Batch deleted products successfully in WooCommerce!")
        }).catch((error) => {
            // Invalid request, for 4xx and 5xx statuses
            console.error("Response Status:", error.response.status);
            console.error("Response Headers:", error.response.headers);
            console.error("Response Data:", error.response.data);
        });
        }) */
    // WooCreateProductsINIT();
}