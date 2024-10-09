import { app, basePath } from '../app.js';
import express from 'express';
import { WooHookAuth } from '../middleware/woocommerce.js'
import { WooHookCreateOrder } from "../woocommerce/orders.js";
import { WooCommerce } from "../config/woocommerce.js";

export function woocommerceRoutes() {
    if (!WooCommerce) return;

    const woocommerceRoutes = express.Router();
    woocommerceRoutes.use(WooHookAuth);

    woocommerceRoutes.post('/woocommerce/hooks/order', async (req, res) => {
        // Use this URL for the WooCommerce hook. Example: https://example.com/server/woocommerce/hooks/order
        try {
            const data = req.body;

            const { status, message } = await WooHookCreateOrder(data);
            if (status !== 201) return res.status(status).send(message);

            console.log('Order from Woo transfered to app!')

            // TODO Create socket event and notification on frontend or something

            res.status(200).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, woocommerceRoutes);
}