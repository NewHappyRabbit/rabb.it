import { WooCommerce } from "../config/woocommerce.js";
import { WooCreateCategoriesINIT } from "./categories.js";
import { WooCheckProductAttributesINIT, WooCreateProductsINIT } from "./products.js";

export async function FirstInitWooCommerce() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    console.log("Starting WooCommerce initialization...")

    // Check if all products attributes exist in WooCommerce, if not - create them

    // WooCheckProductAttributesINIT();
    // WooCreateCategoriesINIT();
    // WooCreateProductsINIT();
}