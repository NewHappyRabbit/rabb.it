import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Category } from "../models/category.js";
import { Product } from "../models/product.js";
import { slugify } from "../models/functions/global.js";
import { WooCreateCategory, WooEditCategory, WooDeleteCategory } from "../woocommerce/categories.js";
import { uploadImg } from "./common.js";
import multer from "multer";
import fs from 'fs';
import { CategoryController } from "./controllers/categories.js";

export function categoriesRoutes() {
    const categoriesRouter = express.Router();

    const storage = multer.memoryStorage();
    const fileFilter = (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png')
            cb(null, true);
        else
            cb(new Error('Only jpeg and png files are allowed!'));
    }

    const imageUploader = multer({
        storage,
        fileFilter
    });

    categoriesRouter.get('/categories', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const categories = await CategoryController.getCategories();

            res.json(categories);
        } catch (error) {
            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    categoriesRouter.post('/categories', permit('manager', 'admin'), imageUploader.single('image'), async (req, res) => {
        try {
            const data = { ...req.body };
            const img = req.file;

            const result = await CategoryController.createCategory({ data, img });
            if (result.status !== 201)
                return res.status(result.status).send(result.message);

            const category = result.category;
            WooCreateCategory(category);

            res.status(201).send();
        } catch (error) {
            console.log(error);

            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    categoriesRouter.put('/categories/:id', permit('manager', 'admin'), imageUploader.single('image'), async (req, res) => {
        try {
            const data = { ...req.body };
            const id = req.params.id;
            const img = req.file;

            const result = await CategoryController.updateCategory({ id, data, img });
            if (result.status !== 201)
                return res.status(result.status).send(result.message);

            const category = result.category;
            WooEditCategory(category);

            res.status(201).send();
        } catch (error) {
            console.log(error);
            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    categoriesRouter.delete('/categories/:id', permit('admin'), async (req, res) => {
        try {
            const id = req.params.id;

            const result = await CategoryController.deleteCategory({ id });
            if (result.status !== 204)
                return res.status(result.status).send(result.message);

            const wooId = result.wooId;

            WooDeleteCategory(wooId);

            res.status(204).send();
        } catch (error) {
            req.log.debug({ body: req.body })
            res.status(500).send(error);
        }
    });

    app.use(basePath, categoriesRouter);
}