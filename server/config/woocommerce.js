import pkg from "@woocommerce/woocommerce-rest-api";
const WooCommerceRestApi = pkg.default;

// If no woo_url is provieded, WooCommerce will not be instantiated and functions will not work
export const WooCommerce = process.env.WOO_URL ? new WooCommerceRestApi({
    url: process.env.WOO_URL,
    consumerKey: process.env.WOO_KEY,
    consumerSecret: process.env.WOO_SECRET,
    version: "wc/v3",
}) : undefined;

if (process.env.WOO_URL)
    console.log('WooCommerce instantiated');