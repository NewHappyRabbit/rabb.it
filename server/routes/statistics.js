import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Order } from '../models/order.js';

export function statisticsRoutes() {
    const router = express.Router();

    router.get('/statistics', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            let data = {}

            // Calcalate total unpaid from all orders
            const orders = await Order.find({ unpaid: true, deleted: false }).select('total paidAmount');

            data.totalUnpaid = orders.reduce((total, order) => total + order.total - order.paidAmount, 0);

            res.json(data);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, router);
}