import crypto from 'crypto';
import { WooCommerce } from '../config/woocommerce.js';
export function WooHookAuth(req, res, next) {
    if (!WooCommerce)
        return res.status(500).send('WooCommerce not instantiated');

    const incomingSignature = req.headers['x-wc-webhook-signature'];
    // const payload = new Buffer(JSON.stringify(req.body), 'utf8');
    const payload = req.rawBody;

    const calculatedSignature = crypto
        .createHmac("sha256", process.env.WOO_HOOKS_SECRET)
        .update(payload)
        .digest("base64");

    if (incomingSignature === calculatedSignature) {
        next();
    } else {
        res.status(200).send();
    }
}