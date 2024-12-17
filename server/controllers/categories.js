import { Category } from "../models/category.js"
import { slugify } from "../models/functions/global.js";
import { Product } from "../models/product.js";
import { uploadImg } from "./common.js";
import fs from 'fs';

export const CategoryController = {
    get: async (filters) => {
        const categories = await Category.find().sort({ path: 1, order: 1 }).lean();
        if (filters.productsCount == 'true') {
            await Promise.all(categories.map(async (category) => {
                category.productsCount = await Product.find({ category: category._id, deleted: false }).countDocuments();
            }));
        }
        return categories;
    },
    post: async ({ data, img }) => {
        if (!data.name)
            return { status: 400, message: 'Въведете име', property: 'name' };

        data.order === '' ? data.order = 0 : data.order = parseInt(data.order);

        // Check if parent exists
        if (data.parent) {
            const parent = await Category.findById(data.parent);
            if (!parent)
                return { status: 400, message: 'Родителската категория не съществува', property: 'parent' };

            parent.path ? data.path = `${parent.path}${parent.slug},` : data.path = `,${parent.slug},`
        }

        // create slug
        var slug = slugify(data.name);

        // Check if exact match
        const exactMatch = await Category.findOne({ slug: slug });
        if (exactMatch) {
            // Check if more than one (ex. test-1, test-2 ....)
            let freeSlug = false, i = 1;
            while (freeSlug === false) {
                const testSlug = slug + '-' + i;
                const temp = await Category.findOne({ slug: testSlug });
                if (temp) {
                    i++
                    continue;
                };

                freeSlug = true;
                slug = testSlug;
            }
        }

        data.slug = slug;

        if (img)
            data.image = await uploadImg(img.buffer, 'categories');

        const category = await new Category(data).save();
        return { category, status: 201 };
    },
    put: async ({ id, data, img }) => {
        if (!data.name) return { status: 400, message: 'Въведете име', property: 'name' };

        const currentCategory = await Category.findById(id);

        if (!currentCategory) return { status: 404, message: 'Категорията не е намерена' };

        data.order === '' ? data.order = 0 : data.order = parseInt(data.order);

        // Check if parent exists
        // data.parent is parentId
        if (data.parent) {
            const parent = await Category.findById(data.parent);
            if (!parent) return { status: 400, message: 'Родителската категория не съществува', property: 'parent' };

            parent.path ? data.path = `${parent.path}${parent.slug},` : data.path = `,${parent.slug},`;
        }

        // create new slug if name has changed
        if (data.name !== currentCategory.name) {
            const oldSlug = currentCategory.slug;
            var newSlug = slugify(data.name);

            const exactMatch = await Category.findOne({ slug: newSlug });
            if (exactMatch) {
                // Check if more than one (ex. test-1, test-2 ....)
                let freeSlug = false, i = 1;
                while (freeSlug === false) {
                    const testSlug = newSlug + '-' + i;
                    const temp = await Category.findOne({ slug: testSlug });
                    if (temp) {
                        i++
                        continue;
                    };

                    freeSlug = true;
                    newSlug = testSlug;
                }
            }

            // update subcategories path
            const categories = await Category.find({ path: { $regex: `,${oldSlug},` } });
            await Promise.all(categories.map(async category => {
                category.path = category.path.replace(`,${oldSlug},`, `,${newSlug},`);
                await category.save();
            }))

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
    delete: async (id) => {
        const category = await Category.findById(id);
        if (!category) return { status: 404, message: 'Категорията не е намерена' };

        // Check if products assigned
        const hasProducts = await Product.find({ category: id }).limit(1);

        if (hasProducts.length > 0)
            return { status: 400, message: 'Категорията има продукти. Моля, първо изтрийте или изместете продуктите.', property: 'products' };

        // Check if subcategories
        const path = category.path ? `${category.path}${category.slug},` : `,${category.slug},`
        const categories = await Category.find({ path: { $regex: path } }).limit(1);

        if (categories.length > 0)
            return { status: 400, message: 'Категорията има подкатегории. Моля, първо изтрийте или изместете подкатегориите.', property: 'subcategories' };

        const wooData = category.woocommerce;

        // delete original image if it exists
        if (category.image) {
            fs.existsSync(category.image.path) &&
                fs.unlink(category.image.path, (err) => {
                    if (err) console.error(err);
                });
        }

        await Category.findByIdAndDelete(id);
        return { status: 204, wooData }
    }
}