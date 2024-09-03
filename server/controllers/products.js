import { AutoIncrement } from "../models/autoincrement.js";
import { Category } from "../models/category.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { uploadImg } from "./common.js";
import fs from 'fs';

async function validateProduct(data) {
    const { category, name, quantity, sizes, deliveryPrice, wholesalePrice, retailPrice, unitOfMeasure } = data;
    if (!category || !name || !quantity || !deliveryPrice || !wholesalePrice || !retailPrice || !unitOfMeasure)
        return { status: 400, message: 'Липсват задължителни полета' };

    const categoryExists = await Category.findOne({ _id: category });

    if (!categoryExists)
        return { status: 400, message: 'Категорията не съществува' };

    // check prices regex
    const regex = /^\d{1,}(\.\d{1,2})?$/;

    if (!regex.test(deliveryPrice))
        return { status: 400, message: 'Грешна доставна цена' };

    if (!regex.test(wholesalePrice))
        return { status: 400, message: 'Грешна цена на едро' };

    if (!regex.test(retailPrice))
        return { status: 400, message: 'Грешна цена на дребно' };

    console.log({ wholesalePrice, retailPrice, deliveryPrice, sizes });
    if (wholesalePrice < retailPrice || sizes.length && retailPrice < (deliveryPrice / sizes.length).toFixed(2))
        return { status: 400, message: 'Продажните цени трябва да са по-големи от доставната' };

    if (sizes.length !== 0) {
        for (const size of sizes) {
            if (!size.size || !size.quantity)
                return { status: 400, message: 'Липсва размер или количество' };

            if (!regex.test(size.quantity))
                return { status: 400, message: 'Невалидно количество за размер' };
        }
    }
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
    get: async ({ page, cursor, search }) => {
        // Page is used to prevent multiple urls from being created and instead using one single get request
        // If no page is given then it will return all products

        if (page && page === 'orders' || page === 'references') {
            const products = await Product.find({ noInvoice: { $ne: true }, outOfStock: { $ne: true } }).select('name code barcode unitOfMeasure type sizes retailPrice wholesalePrice quantity minQty');
            return { products, status: 200 };
        }

        if (page && page === 'restock') {
            const products = await Product.find().select('name code barcode sizes')

            return { products, status: 200 };
        }

        let query = {
            $and: [{ outOfStock: { $ne: true } }, { deleted: { $ne: true } }],
        };

        var prevCursor = null;
        var nextCursor = null;
        var limit = 15;

        cursor && query.$and.push({ _id: { $lte: cursor } });

        if (search)
            query.$or = [{ code: { $regex: search, $options: 'i' } }, { barcode: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }];

        const products = await Product.find(query).limit(limit).sort({ _id: -1 }).populate('category', 'name path');

        if (!products || products.length === 0)
            return { products: [], prevCursor, nextCursor, status: 200 };

        // get next product to generate cursor for traversing
        if (products.length === limit)
            nextCursor = products[products.length - 1]._id;

        if (cursor) {
            const prevQuery = query;
            prevQuery.$and.map(q => {
                if (q._id) q._id = { $gt: cursor };
            })

            const prevProducts = await Product.find(query).sort({ _id: -1 });
            prevCursor = prevProducts[prevProducts.length - limit + 1]?._id || null;
        }

        return { products, prevCursor, nextCursor, status: 200 };
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

        if (data.sizes)
            data.sizes = JSON.parse(data.sizes);

        if (!data.unitOfMeasure && data.sizes?.length > 0)
            data.unitOfMeasure = 'пакет';

        if (!data.unitOfMeasure && data.sizes?.length === 0)
            data.unitOfMeasure = 'бр.';

        const validationError = (await validateProduct(data));

        if (validationError) return validationError;

        if (files.image) {
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

        if (data.code) {
            const codeExists = await Product.findOne({ code: data.code });
            if (codeExists) return { status: 400, message: 'Вече съществува продукт с този код' };
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

        const product = await Product.create(data);
        return { product, status: 201 };
    },
    restock: async (products) => {
        const doneProducts = [];

        for (const product of products) {
            if (product.quantity < 1) return { status: 400, message: `Продуктът с код ${product.code} трябва да има количество по-голямо от 0` };

            // Check if product already in doneProducts
            const found = doneProducts.find(p => p._id == product._id);

            if (found) {
                if (product.sizes.length > 0) {
                    if (product.selectedSizes.length > 0) {
                        for (const size of product.selectedSizes) {
                            found.sizes.map(s => {
                                if (s.size === size)
                                    s.quantity += +product.quantity;
                            })
                        }

                        // set package quantity to smalles size quantity
                        found.quantity = Math.min(...found.sizes.map(s => s.quantity));
                    } else return { status: 400, message: `Изберете поне един размер за продукт с код ${product.code}` }
                } else found.quantity += +product.quantity; // simple product

                continue; // start next iteration
            }

            const dbProduct = await Product.findById(product._id);
            if (!dbProduct) return { status: 400, message: `Продуктът с код ${product.code} не беше намерен в базата данни` };

            if (dbProduct.sizes.length > 0) {
                if (product.selectedSizes.length > 0) {
                    for (const size of product.selectedSizes) {
                        dbProduct.sizes.map(s => {
                            if (s.size === size)
                                s.quantity += +product.quantity;
                        })
                    }
                } else return { status: 400, message: `Изберете поне един размер за продукт с код ${product.code}` }

                // set package quantity to smalles size quantity
                dbProduct.quantity = Math.min(...dbProduct.sizes.map(s => s.quantity));
            } else dbProduct.quantity += +product.quantity; // simple product

            dbProduct.outOfStock = false;

            doneProducts.push(dbProduct);
        }

        doneProducts.forEach(async product => await product.save());

        return { doneProducts, status: 200 };
    },
    put: async ({ id, files, data }) => {
        if (data.noInvoice == "")
            data.noInvoice = true;
        else data.noInvoice = false;

        if (data.sizes)
            data.sizes = JSON.parse(data.sizes);

        if (!data.unitOfMeasure && data.sizes?.length > 0)
            data.unitOfMeasure = 'пакет';

        if (!data.unitOfMeasure && data.sizes?.length === 0)
            data.unitOfMeasure = 'бр.';

        const validationError = (await validateProduct(data));

        if (validationError) return validationError;

        const product = await Product.findById(id);

        if (!product) return { status: 404, message: 'Продуктът не е открит' };

        // Check if new image was uploaded
        if (files.image) {
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
        if (files.additionalImages?.length > 0) {
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
            if (codeExists) return { status: 400, message: 'Вече съществува продукт с този код' };
        }

        if (data.barcode && data.barcode !== product.barcode) { // New product barcode was entered
            if (data.barcode.length !== 13) return { status: 400, message: 'Невалиден баркод. Баркодът трябва да е 13 цифри' };

            const barcodeExists = await Product.findOne({ barcode: data.barcode });
            if (barcodeExists) return { status: 400, message: 'Вече съществува продукт с този баркод' };
        }

        // If new product code was entered and barcode is empty, set barcode
        if (data.barcode === "" && data.code) {
            const newCode = data.code.toString().padStart(12, '0'); // pad code with 0s to 12 digits
            data.barcode = `${newCode}${checkDigitEAN13(newCode.toString())}`;
        }

        await product.updateOne(data, { new: true });
        return { status: 201, product };
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

        const wooId = product.wooId;

        const inDocument = await Order.findOne({ 'products.product': id });
        if (inDocument) {
            product.deleted = true;
            await product.save();
        }
        else await product.deleteOne();

        return { status: 204, wooId };
    }
}