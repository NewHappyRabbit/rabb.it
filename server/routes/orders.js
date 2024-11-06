import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { WooUpdateQuantityProducts } from "../woocommerce/products.js";
import { OrderController } from "../controllers/orders.js";
import { WooUpdateOrder } from "../woocommerce/orders.js";
import { AutoIncrement } from "../models/autoincrement.js";

export async function ordersRoutes() {
    const ordersRouter = express.Router();

    ordersRouter.get('/orders/number', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { documentType, company } = req.query;
            let newDocumentNumber = await AutoIncrement.findOne({ name: documentType === 'credit' ? 'invoice' : documentType, company });

            newDocumentNumber = newDocumentNumber?.seq + 1 || 1;
            res.json(newDocumentNumber);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.get('/orders/params', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const data = OrderController.getParams();

            res.json(data);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.get('/orders', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { from, to, type, orderType, customer, company, paymentType, unpaid, number, pageSize = 15, pageNumber = 1, sort = { _id: -1 } } = req.query;

            const { orders, count, pageCount } = await OrderController.get({ sort, pageNumber, pageSize, from, to, type, orderType, customer, company, paymentType, unpaid, number });

            res.json({ count, orders, pageCount });
        } catch (error) {
            console.error(error);
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
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.post('/orders', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const userId = JSON.parse(req.cookies.user).id;
            const { status, message, order, updatedProducts } = await OrderController.post({ data: { ...req.body }, userId });

            if (status !== 201) return res.status(status).send(message);

            WooUpdateQuantityProducts(updatedProducts);

            res.status(201).send(order._id.toString());
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.put('/orders/:id', permit('manager', 'admin'), async (req, res) => {
        try {
            const data = req.body
            const id = req.params.id;
            const userId = JSON.parse(req.cookies.user).id;

            const { status, message, updatedProducts } = await OrderController.put({ id, data, userId });
            if (status !== 201) return res.status(status).send(message);

            WooUpdateQuantityProducts(updatedProducts);
            WooUpdateOrder(id);

            res.status(201).send(id);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.put('/orders/:id/markPaid', permit('manager', 'admin'), async (req, res) => {
        try {
            const id = req.params.id;
            const userId = JSON.parse(req.cookies.user).id;

            const { status, message } = await OrderController.markPaid({ id, userId });
            if (status !== 201) return res.status(status).send(message);

            res.status(201).send(id);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.delete('/orders/:id', permit('admin'), async (req, res) => {
        try {
            const { returnQuantity } = req.body;
            const { status, message, returnedProducts } = await OrderController.delete(req.params.id, returnQuantity);

            if (status !== 204) return res.status(status).send(message);

            WooUpdateQuantityProducts(returnedProducts);

            res.status(204).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, ordersRouter);
}
