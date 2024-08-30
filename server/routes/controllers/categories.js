import { Category } from "../../models/category.js"
import { slugify } from "../../models/functions/global.js";
import { Product } from "../../models/product.js";
import { uploadImg } from "../common.js";
import fs from 'fs';
import multer from "multer";

export const CategoryController = {
    getCategories: async () => await Category.find().sort({ path: 1, order: 1 }),
    createCategory: async ({ data, img }) => {
        if (!data.name)
            return { status: 400, message: 'Name is required' };
        // return res.status(400).send('Name is required');

        data.order === '' ? data.order = 0 : data.order = parseInt(data.order);

        // Check if parent exists
        if (data.parent) {
            const parent = await Category.findById(data.parent);
            if (!parent)
                return { status: 400, message: 'Parent category does not exist' };
            // return res.status(400).send('Parent category does not exist');

            parent.path ? data.path = `${parent.path}${parent.slug},` : data.path = `,${parent.slug},`
        }

        // create slug
        var slug = slugify(data.name);

        // check if slug exists
        const slugExists = await Category.findOne({ slug: { $regex: slug + '-', $options: 'i' } }).sort({ slug: -1 });

        if (slugExists) // if many slugs (ex -2, -3...)
            slug += `-${Number(slugExists.slug.split('-').pop()) + 1}`;
        else { // if only 1 found (exact)
            const slugExists2 = await Category.findOne({ slug });

            if (slugExists2) slug += '-1';
        }

        data.slug = slug;

        if (img)
            data.image = await uploadImg(img.buffer, 'categories');

        const category = await new Category(data).save();
        return { category, status: 201 };
    },
    updateCategory: async ({ id, data, img }) => {
        if (!data.name) return { status: 400, message: 'Name is required' };

        const currentCategory = await Category.findById(id);

        if (!currentCategory) return { status: 404, message: 'Category not found' };

        data.order === '' ? data.order = 0 : data.order = parseInt(data.order);

        // Check if parent exists
        // data.parent is parentId
        if (data.parent) {
            const parent = await Category.findById(data.parent);
            if (!parent) return { status: 400, message: 'Parent category does not exist' };

            parent.path ? data.path = `${parent.path}${parent.slug},` : data.path = `,${parent.slug},`;
        }

        // create new slug if name has changed
        if (data.name !== currentCategory.name) {
            const oldSlug = currentCategory.slug;
            var newSlug = slugify(data.name);

            // check if slug exists
            const slugExists = await Category.findOne({ slug: { $regex: newSlug + '-', $options: 'i' } }).sort({ slug: -1 });

            if (slugExists) // if many slugs (ex -2, -3...)
                newSlug += `-${Number(slugExists.slug.split('-').pop()) + 1}`;
            else { // if only 1 found (exact)
                const slugExists2 = await Category.findOne({ slug: newSlug });

                if (slugExists2) newSlug += '-1';
            }

            // update subcategories path
            const categories = await Category.find({ path: { $regex: `,${oldSlug},` } });
            for (const category of categories) {
                category.path = category.path.replace(`,${oldSlug},`, `,${newSlug},`);

                await category.save();
            }

            data.slug = newSlug;
        }

        if (img) {
            data.image = await uploadImg(img.buffer, 'categories');

            // delete original image if it exists
            if (currentCategory.image) {
                fs.existsSync(currentCategory.image.path) &&
                    fs.unlink(currentCategory.image.path, (err) => {
                        if (err) console.error(err);
                    });
            }
        }

        await currentCategory.updateOne(data);
        const category = await Category.findById(id);

        return { category, status: 201 };
    },
    deleteCategory: async ({ id }) => {
        const category = await Category.findById(id);
        if (!category) return { status: 404, message: 'Category not found' };

        // Check if products assigned
        const hasProducts = (await Product.find({ category: id }).limit(1)).length > 0;

        if (hasProducts)
            return { status: 400, message: 'Категорията има продукти. Моля, първо изтрийте или изместете продуктите.' };

        // Check if subcategories
        const path = category.path ? `${category.path}${category.slug},` : `,${category.slug},`
        const categories = await Category.find({ path: { $regex: path } }).limit(1);

        if (categories.length > 0)
            return { status: 400, message: 'Категорията има подкатегории. Моля, първо изтрийте или изместете подкатегориите.' };

        const wooId = category.wooId;

        // delete original image if it exists
        if (category.image) {
            fs.existsSync(category.image.path) &&
                fs.unlink(category.image.path, (err) => {
                    if (err) console.error(err);
                });
        }

        await Category.findByIdAndDelete(id);
        return { status: 204, wooId }
    }
}

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png')
        cb(null, true);
    else
        cb(new Error('Only jpeg and png files are allowed!'));
}

export const imageUploader = multer({
    storage,
    fileFilter
});