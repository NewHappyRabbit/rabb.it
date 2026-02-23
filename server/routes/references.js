import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { ReferencesController } from "../controllers/references.js";

export function referencesSalesRoutes() {
    const referencesRouter = express.Router();

    referencesRouter.get('/references/orders', permit('manager', 'admin'), async (req, res) => {
        try {
            const { pageSize = 15, pageNumber = 1, print = false, user, from, to, type, orderType, customer, company, paymentType, unpaid, numberFrom, numberTo, product } = req.query;

            const { orders, count, pageCount } = await ReferencesController.get({ pageSize, pageNumber, print, user, from, to, type, orderType, customer, company, paymentType, unpaid, numberFrom, numberTo, product });

            res.json({ orders, count, pageCount });
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    referencesRouter.get('/references/stocks', permit('manager', 'admin'), async (req, res) => {
        try {
            const { pageSize = 15, pageNumber = 1, print = false } = req.query;

            const { products, count, pageCount } = await ReferencesController.getStocks({ pageSize, pageNumber, print });

            res.json({ products, count, pageCount });
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    referencesRouter.get('/references/accounting', permit('manager', 'admin'), async (req, res) => {
        try {
            const { from, to, company, detailed = false } = req.query;
            const { orders } = await ReferencesController.getAccounting({ from, to, company, detailed });
            res.json({ orders });
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    })

    app.use(basePath, referencesRouter);
}