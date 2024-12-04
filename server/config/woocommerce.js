import pkg from "@woocommerce/woocommerce-rest-api";
const WooCommerceRestApi = pkg.default;


const shops = process.env.WOO_SHOPS ? JSON.parse(process.env.WOO_SHOPS) : [];
export var WooCommerce_Shops = [];
for (let shop of shops) {
    if (shop.WOO_URL && shop.WOO_KEY && shop.WOO_SECRET && shop.WOO_HOOKS_SECRET) {
        const t = new WooCommerceRestApi({
            url: shop.WOO_URL,
            consumerKey: shop.WOO_KEY,
            consumerSecret: shop.WOO_SECRET,
            version: "wc/v3",
        });

        t.custom = shop.custom;
        WooCommerce_Shops.push(t);
    }
}

// console.log(JSON.parse(process.env.WOO_SHOPS));

// FIXME REMOVE BELOW CODE AND USE ONLY WOOCOMMERCE_SHOPS VARIABLE
export const WooCommerce = WooCommerce_Shops[0] || undefined;
export const WooCommerce_Retail = WooCommerce_Shops[1] || undefined;

if (WooCommerce) console.log('WooCommerce instantiated');