import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { WooCreateCategory, WooEditCategory, WooDeleteCategory } from "../woocommerce/categories.js";
import { CategoryController } from "../controllers/categories.js";
import { imageUploader } from "../controllers/common.js";

export function categoriesRoutes() {
    const categoriesRouter = express.Router();

    categoriesRouter.get('/categories', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const filters = req.query;
            const categories = await CategoryController.get(filters);

            res.json(categories);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    categoriesRouter.post('/categories', permit('manager', 'admin'), imageUploader.single('image'), async (req, res) => {
        try {
            const data = { ...req.body };
            const img = req.file;

            const { status, message, category } = await CategoryController.post({ data, img });
            if (status !== 201)
                return res.status(status).send(message);

            WooCreateCategory(category);

            res.status(201).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    categoriesRouter.put('/categories/:id', permit('manager', 'admin'), imageUploader.single('image'), async (req, res) => {
        try {
            const data = { ...req.body };
            const id = req.params.id;
            const img = req.file;

            const { status, message, category } = await CategoryController.put({ id, data, img });
            if (status !== 201)
                return res.status(status).send(message);

            WooEditCategory(category);

            res.status(201).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    categoriesRouter.delete('/categories/:id', permit('admin'), async (req, res) => {
        try {
            const id = req.params.id;

            const { status, message, wooData } = await CategoryController.delete(id);
            if (status !== 204)
                return res.status(status).send(message);

            if (wooData) WooDeleteCategory(wooData);

            res.status(204).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    app.use(basePath, categoriesRouter);
}