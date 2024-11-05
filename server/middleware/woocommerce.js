import crypto from 'crypto';
import { WooCommerce } from '../config/woocommerce.js';
export function WooHookAuth(req, res, next) {
    if (!WooCommerce)
        return res.status(500).send('WooCommerce not instantiated');

    const incomingSignature = req.headers['x-wc-webhook-signature'];
    if (!incomingSignature) return res.status(200).send('No signature found');

    // const payload = new Buffer(JSON.stringify(req.body), 'utf8');
    const payload = req.rawBody;

    const calculatedSignature = crypto
        .createHmac("sha256", process.env.WOO_HOOKS_SECRET)
        .update(payload)
        .digest("base64");

    if (incomingSignature === calculatedSignature) {
        console.log('Woo hook accepted')
        next();
    } else {
        console.log('Woo hook secret incorrect!')
        res.status(401).send();
    }
}