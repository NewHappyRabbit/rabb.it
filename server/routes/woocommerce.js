import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { WooHookAuth } from '../middleware/woocommerce.js'

export function woocommerceRoutes() {
    const woocommerceRoutes = express.Router();
    woocommerceRoutes.use(WooHookAuth);

    woocommerceRoutes.post('/woocommerce/hooks/order', async (req, res) => {
        try {
            // TODO Add secret check as middleware
            const data = req.body;


            console.log('hi')
            console.log(data);
            res.status(200).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, woocommerceRoutes);
}