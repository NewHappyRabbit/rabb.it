import { app, basePath } from '../app.js';
import express from 'express';
import { WooHookAuth } from '../middleware/woocommerce.js'
import { WooHookCreateOrder } from "../woocommerce/orders.js";
import { WooCommerce } from "../config/woocommerce.js";

export function woocommerceRoutes() {
    if (!WooCommerce) return;

    const woocommerceRoutes = express.Router();

    woocommerceRoutes.post('/woocommerce/hooks/order', WooHookAuth, async (req, res) => {
        // Use this URL for the WooCommerce hook. Example: https://example.com/server/woocommerce/hooks/order
        try {
            const shop = req.shop; // Which Woo shop the request is coming from
            const data = req.body;

            const { status, message } = await WooHookCreateOrder({ shop, data });
            if (status !== 201) {
                console.error(`Error creating the woo order with ID: ${data.id} from hook: ${message}`);
                console.error('Shop: ' + shop)
                console.error('Data: ' + JSON.stringify(data));
                return res.status(status).send(message)
            };

            console.log(`Order with ID: ${data.id} from Woo transfered to app! [${shop.url}]`);

            res.status(200).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, woocommerceRoutes);
}