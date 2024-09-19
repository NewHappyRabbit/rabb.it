import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { ReferencesController } from "../controllers/references.js";

export function referencesSalesRoutes() {
    const salesRouter = express.Router();

    salesRouter.get('/references/orders', permit('manager', 'admin'), async (req, res) => {
        try {
            const { print, orders, prevCursor, nextCursor } = await ReferencesController.get(req.query);

            res.json({ print, orders, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, salesRouter);
}