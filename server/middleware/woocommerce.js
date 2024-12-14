import crypto from 'crypto';
import { WooCommerce_Shops } from '../config/woocommerce.js';
export function WooHookAuth(req, res, next) {
    if (WooCommerce_Shops.length === 0)
        return res.status(500).send('WooCommerce not instantiated');

    const incomingSignature = req.headers['x-wc-webhook-signature'];
    if (!incomingSignature) return res.status(200).send('No signature found');

    // const payload = new Buffer(JSON.stringify(req.body), 'utf8');
    const payload = req.rawBody;

    const incomingWebsite = req.headers['x-wc-webhook-source'];
    const shop = WooCommerce_Shops.find(shop => shop.url + '/' === incomingWebsite);
    if (!shop) return res.status(200).send('No matching shop found');
    req.shop = shop;

    const calculatedSignature = crypto
        .createHmac("sha256", shop.hook_secret)
        .update(payload)
        .digest("base64");

    if (incomingSignature === calculatedSignature) {
        console.log('Woo hook accepted from' + incomingWebsite);
        next();
    } else {
        console.log('Woo hook secret incorrect!')
        res.status(401).send();
    }
}