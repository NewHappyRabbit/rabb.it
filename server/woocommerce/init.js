import { WooCommerce_Shops } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { ProductAttribute } from "../models/product_attribute.js";
import { WooCreateCategoriesINIT } from "./categories.js";
import { WooCheckProductAttributesINIT, WooCreateProductsINIT } from "./products.js";

export async function FirstInitWooCommerce() {
    if (WooCommerce_Shops?.length === 0) return; // If woocommerce wasnt initalized or is not used

    console.log("Starting WooCommerce initialization...")
    // FIXME TEMP THE BELOW CODE IS TO BE RUN ONLY ONCE TO TRANSFORM OLD DATA TO NEW DATA TYPE!!!
    // Fix categories to use new data type
    /* const categories = await Category.find({ "woocommerce.woo_url": { $exists: false } });
    for (const category of categories) category.woocommerce[0].woo_url = WooCommerce_Shops[0].url
    await Promise.all(categories.map(async (c) => await c.save()));
    console.log('Categories data type fixed!');

    // Fix orders to use new data type
    const orders = await Order.find({ "woocommerce": { $exists: true }, "woocommerce.woo_url": { $exists: false } });
    for (const order of orders) order.woocommerce[0].woo_url = WooCommerce_Shops[0].url
    await Promise.all(orders.map(async (o) => await o.save()));
    console.log('Orders data type fixed!'); */

    // Fix products to use new data type
    /* const products = await Product.find({ "woocommerce": { $exists: true }, "woocommerce.woo_url": { $exists: false }, deleted: false, hidden: false });
    for (const product of products) {
        product.woocommerce[0]._id = undefined;
        product.woocommerce[0].woo_url = WooCommerce_Shops[0].url
    }
    await Promise.all(products.map(async (p) => await p.save()));
    console.log('Products data type fixed!'); */

    // Fix product attributes to use new data type
    /* const productAttributes = await ProductAttribute.find({ "woocommerce": { $exists: true }, "woocommerce.woo_url": { $exists: false } });
    for (const productAttribute of productAttributes) {
        productAttribute.woocommerce[0]._id = undefined;
        productAttribute.woocommerce[0].woo_url = WooCommerce_Shops[0].url
    }
    await Promise.all(productAttributes.map(async (p) => await p.save()));
    console.log('Product attributes data type fixed!'); */
    // Check if all products attributes exist in WooCommerce, if not - create them
    // await WooCheckProductAttributesINIT();
    // await WooCreateCategoriesINIT();
    // await WooCreateProductsINIT();
}