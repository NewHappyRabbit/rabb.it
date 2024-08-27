import { Category } from "../../models/category.js"
import { slugify } from "../../models/functions/global.js";
import { uploadImg } from "../common.js";

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
            data.image = await uploadImg(img.buffer);

        return { category: await new Category(data).save(), status: 201 };
    }
}