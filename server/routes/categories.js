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
            req.log.debug({ body: req.body }) // Log the body of the request
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
            req.log.info(category, 'Category created');
        } catch (error) {
            console.log(error);

            req.log.debug({ body: req.body }) // Log the body of the request
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
            req.log.info(category, 'Category updated')
        } catch (error) {
            console.log(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    categoriesRouter.delete('/categories/:id', permit('admin'), async (req, res) => {
        try {
            const id = req.params.id;
            const category = await Category.findById(id);
            if (!category)
                return res.status(404).send('Category not found');

            // Check if products assigned
            const hasProducts = (await Product.find({ category: id }).limit(1)).length > 0;

            if (hasProducts)
                return res.status(400).send('Категорията има продукти. Моля, първо изтрийте или изместете продуктите.');

            // Check if subcategories
            const path = category.path ? `${category.path}${category.slug},` : `,${category.slug},`
            const categories = await Category.find({ path: { $regex: path } }).limit(1);

            if (categories.length > 0)
                return res.status(400).send('Категорията има подкатегории. Моля, първо изтрийте или изместете подкатегориите.');

            const wooId = category.wooId;

            // delete original image if it exists
            if (category.image) {
                fs.existsSync(category.image.path) &&
                    fs.unlink(category.image.path, (err) => {
                        if (err) console.error(err);
                    });
            }

            await Category.findByIdAndDelete(id);
            WooDeleteCategory(wooId);

            res.status(204).send();
            req.log.info(category, 'Category deleted')
        } catch (error) {
            console.log(error);
            // req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, categoriesRouter);
}