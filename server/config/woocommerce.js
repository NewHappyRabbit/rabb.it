import pkg from "@woocommerce/woocommerce-rest-api";
const WooCommerceRestApi = pkg.default;

// If no woo_url is provided, WooCommerce will not be instantiated and functions will not work
export const WooCommerce = process.env.WOO_URL && process.env.WOO_KEY && process.env.WOO_SECRET && process.env.WOO_HOOKS_SECRET ? new WooCommerceRestApi({
    url: process.env.WOO_URL,
    consumerKey: process.env.WOO_KEY,
    consumerSecret: process.env.WOO_SECRET,
    version: "wc/v3",
}) : undefined;

if (WooCommerce)
    WooCommerce.custom = {
        type: 'wholesale',
        price: 'wholesalePrice'
    }

export const WooCommerce_Retail = process.env.WOO_URL_RETAIL && process.env.WOO_KEY_RETAIL && process.env.WOO_SECRET_RETAIL && process.env.WOO_HOOKS_SECRET_RETAIL ? new WooCommerceRestApi({
    url: process.env.WOO_URL_RETAIL,
    consumerKey: process.env.WOO_KEY_RETAIL,
    consumerSecret: process.env.WOO_SECRET_RETAIL,
    version: "wc/v3",
}) : undefined;

if (WooCommerce_Retail)
    WooCommerce_Retail.custom = {
        type: 'retail',
        price: 'retailPrice'
    }

export const WooCommerce_Shops = [WooCommerce, WooCommerce_Retail];

if (WooCommerce) console.log('WooCommerce instantiated');