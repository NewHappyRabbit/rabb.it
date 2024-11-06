import { AutoIncrement } from "../models/autoincrement.js";
import { Category } from "../models/category.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { Setting } from "../models/setting.js";
import { uploadImg } from "./common.js";
import fs from 'fs';

async function validateProduct(data) {
    const { category, name, quantity, sizes, deliveryPrice, wholesalePrice, retailPrice, unitOfMeasure, multiplier } = data;

    if (!name) return { status: 400, message: 'Въведете име', property: 'name' };

    if (!quantity) return { status: 400, message: 'Въведете количество', property: 'quantity' };

    if (!deliveryPrice) return { status: 400, message: 'Въведете доставна цена', property: 'deliveryPrice' };

    if (!wholesalePrice) return { status: 400, message: 'Въведете цена на едро', property: 'wholesalePrice' };

    if (!retailPrice) return { status: 400, message: 'Въведете цена на дребно', property: 'retailPrice' };

    if (!unitOfMeasure) return { status: 400, message: 'Въведете мярка', property: 'unitOfMeasure' };

    // check prices regex
    const regex = /^\d{1,}(\.\d{1,2})?$/;

    if (!regex.test(deliveryPrice))
        return { status: 400, message: 'Грешна доставна цена', property: 'deliveryPrice' };

    if (!regex.test(wholesalePrice))
        return { status: 400, message: 'Грешна цена на едро', property: 'wholesalePrice' };

    if (!regex.test(retailPrice))
        return { status: 400, message: 'Грешна цена на дребно', property: 'retailPrice' };

    if (Number(wholesalePrice) <= Number(deliveryPrice))
        return { status: 400, message: 'Цената на едро трябва да е по-голяма от доставната', property: 'wholesalePrice' };

    if ((sizes.length === 0 && Number(retailPrice) <= Number(deliveryPrice)) || sizes.length !== 0 && Number(retailPrice) <= Number(deliveryPrice / (sizes.length * multiplier)))
        return { status: 400, message: 'Цената на дребно трябва да е по-голяма от доставната', property: 'retailPrice' };
    else if (sizes.length !== 0) {
        for (const size of sizes) {
            if (!size.size || !size.quantity)
                return { status: 400, message: 'Липсва размер или количество', property: 'sizes' };

            if (!regex.test(size.quantity))
                return { status: 400, message: 'Невалидно количество за размер', property: 'sizes' };
        }
    }

    if (!category) return { status: 400, message: 'Изберете категория', property: 'category' };
    const categoryExists = await Category.findOne({ _id: category });
    if (!categoryExists)
        return { status: 400, message: 'Категорията не съществува', property: 'category' };
}

function checkDigitEAN13(barcode) {
    const sum = barcode.split('')
        .map((n, i) => n * (i % 2 ? 3 : 1)) // alternate between multiplying with 3 and 1
        .reduce((sum, n) => sum + n, 0) // sum all values

    const roundedUp = Math.ceil(sum / 10) * 10; // round sum to nearest 10

    const checkDigit = roundedUp - sum; // subtract round to sum = check digit

    return checkDigit;
}

export const ProductController = {
    find: async (search) => {
        // Find product using searh as code or barcode


        const query = {
            noInvoice: { $ne: true },
            outOfStock: { $ne: true },
            $or: [{ code: search }, { barcode: search }, { barcode: search.slice(0, -1) }]
        }

        if (search.length === 12) { // scanned with barcode gun, add checkdigit to barcode
            query.$or.push({ barcode: `0${search}` });
            query.$or.push({ barcode: `${search}${checkDigitEAN13(search.toString())}` });
        }

        const product = await Product.findOne(query);

        return { product, status: 200 };
    },
    get: async ({ pageNumber, pageSize, page, search, onlyHidden, onlyOutOfStock, onlyOpenedPackages }) => {
        // Page is used to prevent multiple urls from being created and instead using one single get request
        // If no page is given then it will return all products

        if (page && page === 'orders') {
            const products = await Product.find({ noInvoice: { $ne: true }, outOfStock: { $ne: true } }).select('name code barcode unitOfMeasure type sizes retailPrice wholesalePrice quantity minQty multiplier');
            return { products, status: 200 };
        }

        if (page && page === 'references') {
            const products = await Product.find().select('name code barcode unitOfMeasure type sizes retailPrice wholesalePrice quantity minQty multiplier');
            return { products, status: 200 };
        }

        if (page && page === 'restock') {
            const products = await Product.find().select('name code barcode sizes')

            return { products, status: 200 };
        }

        onlyOutOfStock = onlyOutOfStock && onlyOutOfStock === 'true' ? true : false;

        let query = {
            $and: [{ outOfStock: { $eq: onlyOutOfStock } }, { deleted: { $ne: true } }],
        };

        if (onlyHidden && onlyHidden === 'true')
            query.$and.push({ hidden: true });

        if (search)
            query.$or = [{ code: { $regex: search, $options: 'i' } }, { barcode: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }];

        if (onlyOpenedPackages && onlyOpenedPackages === 'true')
            query.$and.push({ openedPackages: true });

        var products = await Product.find(query).limit(pageSize).skip(pageSize * (pageNumber - 1)).sort({ _id: -1 }).populate('category', 'name path');
        var count = await Product.countDocuments(query);
        var pageCount = Math.ceil(count / pageSize);

        if (!products || products.length === 0)
            return { count, pageCount, products: [], status: 200 };

        return { count, pageCount, products, status: 200 };
    },
    getById: async (id) => {
        const product = await Product.findById(id);
        if (!product) return { status: 404, message: "Продуктът не е намерен" }
        return { product, status: 200 };
    },
    post: async ({ data, files }) => {
        if (data.printLabel == "")
            data.printLabel = true;
        else data.printLabel = false;

        if (data.hidden == "")
            data.hidden = true;
        else data.hidden = false;

        if (data.noInvoice == "")
            data.noInvoice = true;
        else data.noInvoice = false;

        if (data.sizes && typeof data.sizes !== 'object')
            data.sizes = JSON.parse(data.sizes);
        else if (!data.sizes) data.sizes = [];

        if (!data.unitOfMeasure && data.sizes?.length > 0)
            data.unitOfMeasure = 'пакет';

        if (!data.unitOfMeasure && data.sizes?.length === 0)
            data.unitOfMeasure = 'бр.';

        if (!data.multiplier)
            data.multiplier = 1;

        const validation = await validateProduct(data);

        if (validation) return validation;

        if (files?.image) {
            const mainImage = files.image[0].buffer;
            data.image = await uploadImg(mainImage, 'products');

            if (files.additionalImages?.length > 0) {
                const additionalImages = files.additionalImages.map(file => file.buffer);
                var additionalImagesPaths = [];
                for (const img of additionalImages)
                    additionalImagesPaths.push(await uploadImg(img, 'products'));

                data.additionalImages = additionalImagesPaths;
            } else data.additionalImages = [];
        }

        if (data.code && data.code.trim() !== '') {
            const codeExists = await Product.findOne({ code: data.code });
            if (codeExists) return { status: 400, message: 'Вече съществува продукт с код: ' + data.code };
        } else {
            var seq = await AutoIncrement.findOneAndUpdate({ name: 'product' }, { $inc: { seq: 1 } }, { new: true }).select('seq');

            if (!seq)
                seq = await AutoIncrement.create({ name: 'product', seq: 1 });

            data.code = seq.seq;
        }

        if (!data.barcode) { // generate barcode based on product code
            const newCode = data.code.toString().padStart(12, '0'); // pad code with 0s to 12 digits
            data.barcode = `${newCode}${checkDigitEAN13(newCode.toString())}`;
        } else if (data.barcode.length !== 13) return { status: 400, message: 'Невалиден баркод. Баркодът трябва да е 13 цифри' };

        const barcodeExists = await Product.findOne({ barcode: data.barcode });
        if (barcodeExists) return { status: 400, message: 'Вече съществува продукт с този баркод' };

        // FIXME DELETE THIS AFTER SVILEN IS DONE WITH PRODUCTS ADDING
        if (!data.description && data.sizes.length > 0)
            data.description = `${data.name} - ${data.sizes[0].size}-${data.sizes[data.sizes.length - 1].size} - ${data.sizes.length * data.multiplier}бр. в серия по ${Number(data.wholesalePrice / (data.sizes.length * data.multiplier)).toFixed(2)} лв. - Код ${data.code}`;
        else if (!data.description)
            data.description = `${data.name} - ${Number(data.wholesalePrice).toFixed(2)} лв. - Код ${data.code}`;

        // Update upsaleAmount in settings
        await Setting.updateOne({ key: 'upsaleAmount' }, { value: data.upsaleAmount });

        const product = await Product.create(data);
        return { product, status: 201 };
    },
    restock: async (products) => {
        const doneProducts = [];

        for (const product of products) {
            if (product.quantity < 1) return { status: 400, message: `Продуктът с код ${product.code} трябва да има количество по-голямо от 0`, property: 'quantity', product: product._id };

            // Check if product already in doneProducts
            const found = doneProducts.find(p => p._id.toString() == product._id.toString());

            if (found) {
                if (found.sizes?.length > 0) {
                    for (let size of found.sizes) size.quantity += +product.quantity * found.multiplier;

                    // set package quantity to smallest size quantity
                    found.quantity = parseInt(Math.min(...found.sizes.map(s => s.quantity)) / product.multiplier);
                } else found.quantity += +product.quantity; // simple product

                continue; // start next iteration
            }

            const dbProduct = await Product.findById(product._id);
            if (!dbProduct) return { status: 404, message: `Продуктът с код ${product.code} не беше намерен в базата данни` };

            if (dbProduct.sizes.length > 0) {
                for (let size of dbProduct.sizes) size.quantity += +product.quantity * dbProduct.multiplier;

                // set package quantity to smalles size quantity
                dbProduct.quantity = parseInt(Math.min(...dbProduct.sizes.map(s => s.quantity)) / dbProduct.multiplier);
            } else dbProduct.quantity += +product.quantity; // simple product

            dbProduct.outOfStock = false;

            doneProducts.push(dbProduct);
        }

        //TODO TEST IF THIS FIXES THE WOOCOMMERCE BUG WITH QUANTITIES
        await Promise.all(doneProducts.map(async (product) => await product.save()));
        // doneProducts.forEach(async product => await product.save());

        return { doneProducts, status: 200 };
    },
    put: async ({ id, files, data }) => {
        if (data.noInvoice == "")
            data.noInvoice = true;
        else data.noInvoice = false;

        if (data.sizes && typeof data.sizes !== 'object')
            data.sizes = JSON.parse(data.sizes);
        else if (!data.sizes) data.sizes = [];

        if (!data.unitOfMeasure && data.sizes?.length > 0)
            data.unitOfMeasure = 'пакет';

        if (!data.unitOfMeasure && data.sizes?.length === 0)
            data.unitOfMeasure = 'бр.';

        const validate = await validateProduct(data);

        if (validate) return validate;

        const product = await Product.findById(id);

        if (!product) return { status: 404, message: 'Продуктът не е открит' };

        // Check if new image was uploaded
        if (files?.image) {
            const mainImage = files.image[0].buffer;
            data.image = await uploadImg(mainImage, 'products');
            // delete original image if it exists
            if (product.image) {
                fs.existsSync(product.image.path) &&
                    fs.unlink(product.image.path, (err) => {
                        if (err) console.error(err);
                    });
            }
        } else if (product.image)
            data.image = product.image;

        //TODO Test what happens with images when changing on the ecommerce
        if (files?.additionalImages?.length > 0) {
            const additionalImages = files.additionalImages.map(file => file.buffer);
            var additionalImagesPaths = [];
            for (const img of additionalImages)
                additionalImagesPaths.push(await uploadImg(img, 'products'));

            data.additionalImages = additionalImagesPaths;

            // delete original images if they exist
            if (product.additionalImages.length > 0) {
                for (const img of product.additionalImages) {
                    fs.existsSync(img.path) &&
                        fs.unlink(img.path, (err) => {
                            if (err) console.error(err);
                        });
                }
            }
        } else data.additionalImages = product.additionalImages;

        if (data.code && data.code !== product.code) { // New product code was entered
            const codeExists = await Product.findOne({ code: data.code });
            if (codeExists) return { status: 400, message: 'Вече съществува продукт с код: ' + data.code, property: 'code' };
        }

        if (data.barcode && data.barcode !== product.barcode) { // New product barcode was entered
            if (data.barcode.length !== 13) return { status: 400, message: 'Невалиден баркод. Баркодът трябва да е 13 цифри', property: 'barcode' };

            const barcodeExists = await Product.findOne({ barcode: data.barcode });
            if (barcodeExists) return { status: 400, message: 'Вече съществува продукт с този баркод', property: 'barcode' };
        }

        // If new product code was entered and barcode is empty, set barcode
        if (data.barcode === "" && data.code) {
            const newCode = data.code.toString().padStart(12, '0'); // pad code with 0s to 12 digits
            data.barcode = `${newCode}${checkDigitEAN13(newCode.toString())}`;
        }

        // FIXME DELETE THIS AFTER SVILEN IS DONE WITH PRODUCTS ADDING
        if (!data.description && data.sizes.length > 0)
            data.description = `${data.name} - ${data.sizes[0].size}-${data.sizes[data.sizes.length - 1].size} - ${data.sizes.length * data.multiplier}бр. в серия по ${Number(data.wholesalePrice / (data.sizes.length * data.multiplier)).toFixed(2)} лв. - Код ${data.code}`;
        else if (!data.description)
            data.description = `${data.name} - ${Number(data.wholesalePrice).toFixed(2)} лв. - Код ${data.code}`;

        if (data.sizes.length !== 0)
            data.openedPackages = data.sizes.some(s => s.quantity !== data.sizes[0].quantity);

        // Update upsaleAmount in settings
        await Setting.updateOne({ key: 'upsaleAmount' }, { value: data.upsaleAmount });

        await product.updateOne(data, { new: true });
        const updatedProduct = await Product.findById(id);
        return { status: 201, product: updatedProduct };
    },
    delete: async (id) => {
        const product = await Product.findById(id);

        if (!product) return { status: 404, message: 'Продуктът не е открит' };

        // delete images
        if (product.image) {
            fs.existsSync(product.image.path) &&
                fs.unlink(product.image.path, (err) => {
                    if (err) console.error(err);
                });
            product.image = null;
        }

        if (product.additionalImages.length > 0) {
            for (const img of product.additionalImages) {
                fs.existsSync(img.path) &&
                    fs.unlink(img.path, (err) => {
                        if (err) console.error(err);
                    });
            }

            product.additionalImages = [];
        }

        const wooId = product.woocommerce.id;

        const inDocument = await Order.findOne({ 'products.product': id });
        if (inDocument) {
            product.deleted = true;
            await product.save();
        } else await product.deleteOne();

        return { status: 204, wooId };
    }
}