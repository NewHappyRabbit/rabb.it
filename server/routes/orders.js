import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { WooUpdateQuantityProducts } from "../woocommerce/products.js";
import { OrderController } from "../controllers/orders.js";

export function ordersRoutes() {
    const ordersRouter = express.Router();

    ordersRouter.get('/orders/params', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const data = OrderController.getParams();

            res.json(data);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.get('/orders', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { orders, prevCursor, nextCursor } = await OrderController.get({ ...req.query });

            res.json({ orders, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.get('/orders/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { order, status, message } = await OrderController.getById(req.params.id);

            if (status !== 200) return res.status(status).send(message);

            res.json(order);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.post('/orders', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const userId = JSON.parse(req.cookies.user).id;
            const { status, message, order, savedProducts } = await OrderController.post({ data: { ...req.body }, userId });

            if (status !== 201) return res.status(status).send(message);

            WooUpdateQuantityProducts(savedProducts);

            res.status(201).send(order._id.toString());
        } catch (error) {
            console.error(error);
            // req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.put('/orders/:id', permit('manager', 'admin'), async (req, res) => {
        try {
            const data = req.body
            const id = req.params.id;
            const userId = JSON.parse(req.cookies.user).id;

            const { status, message, returnedProducts, savedProducts } = await OrderController.put({ id, data, userId });
            if (status !== 201) return res.status(status).send(message);

            //TODO Do update qty here somehow
            // Get all product ids from returnedProducts and savedProducts, remove duplicates and send quantities to WooCommerce
            // WooUpdateQuantityProducts()

            res.status(201).send(id);
        } catch (error) {
            console.log(error);
            // req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.delete('/orders/:id', permit('admin'), async (req, res) => {
        try {
            const { status, message, returnedProducts } = await OrderController.delete(req.params.id);

            if (status !== 204) return res.status(status).send(message);

            //TODO Test if woo works because i've changed the logic
            WooUpdateQuantityProducts(returnedProducts);

            res.status(204).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, ordersRouter);
}