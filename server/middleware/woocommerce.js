import crypto from 'crypto';
import { WooCommerce } from '../config/woocommerce.js';
export function WooHookAuth(req, res, next) {
    if (!WooCommerce)
        return res.status(500).send('WooCommerce not instantiated');

    const incomingSignature = req.headers['x-wc-webhook-signature'];
    const payload = JSON.stringify(req.body);

    const calculatedSignature = crypto
        .createHmac("sha256", process.env.WOO_HOOKS_SECRET)
        .update(payload)
        .digest("base64");

    console.log({ incomingSignature, calculatedSignature })

    if (incomingSignature === calculatedSignature) {
        next();
    } else {
        res.status(200).send();
    }
}