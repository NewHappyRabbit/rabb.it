// https://dev.to/franciscomendes10866/image-compression-with-node-js-4d7h
import { permit } from "../middleware/auth.js";
import { app, basePath, io } from '../app.js';
import express from 'express';
import { Product } from "../models/product.js";
import { AutoIncrement } from "../models/autoincrement.js";
import { Category } from "../models/category.js";
import multer from 'multer';
import fs from 'fs';
import { Order } from "../models/order.js";
import { WooCreateProduct, WooDeleteProduct, WooEditProduct, WooGetAllProductURLS, WooUpdateQuantityProducts } from "../woocommerce/products.js";
import { uploadImg } from "./common.js";

export function productSockets(socket) {
    socket.on('send-print', (product, quantity) => {
        if (!product || !product.name || !product.code || !product.barcode || !product.wholesalePrice || !quantity) return;
        const minifiedProduct = {
            name: product.name,
            code: product.code,
            barcode: product.barcode,
            wholesalePrice: product.wholesalePrice
        }

        if (product.sizes.length)
            minifiedProduct.sizes = product.sizes;

        io.emit('print', minifiedProduct, quantity);
    })
}

function checkDigitEAN13(barcode) {
    const sum = barcode.split('')
        .map((n, i) => n * (i % 2 ? 3 : 1)) // alternate between multiplying with 3 and 1
        .reduce((sum, n) => sum + n, 0) // sum all values

    const roundedUp = Math.ceil(sum / 10) * 10; // round sum to nearest 10

    const checkDigit = roundedUp - sum; // subtract round to sum = check digit

    return checkDigit;
}


async function validateProduct(data) {
    const { category, name, quantity, sizes, deliveryPrice, wholesalePrice, retailPrice } = data;
    if (!category || !name || !quantity || !deliveryPrice || !wholesalePrice || !retailPrice)
        return { status: 400, error: 'Липсват задължителни полета' };

    const categoryExists = await Category.findOne({ _id: category });

    if (!categoryExists)
        return { status: 400, error: 'Категорията не съществува' };

    // check prices regex
    const regex = /^\d{1,}(\.\d{1,2})?$/;

    if (!regex.test(deliveryPrice))
        return { status: 400, error: 'Грешна доставна цена' };

    if (!regex.test(wholesalePrice))
        return { status: 400, error: 'Грешна цена на едро' };

    if (!regex.test(retailPrice))
        return { status: 400, error: 'Грешна цена на дребно' };

    if (sizes.length !== 0) {
        for (const size of sizes) {
            if (!size.size || !size.quantity)
                return { status: 400, error: 'Липсва размер или количество' };

            if (!regex.test(size.quantity))
                return { status: 400, error: 'Невалидно количество за размер' };
        }
    }

}

export function productsRoutes() {
    const productsRouter = express.Router();
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

    productsRouter.get('/products', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            let query = {
                $and: [{ outOfStock: { $ne: true } }, { deleted: { $ne: true } }],
            };

            const { cursor, search } = req.query;
            var prevCursor = null;
            var nextCursor = null;
            var limit = 15;

            cursor && query.$and.push({ _id: { $lte: cursor } });

            if (search)
                query.$or = [{ code: { $regex: search, $options: 'i' } }, { barcode: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }];

            const products = await Product.find(query).limit(limit).sort({ _id: -1 }).populate('category', 'name path');

            if (!products || products.length === 0)
                return res.json({ products: [], prevCursor, nextCursor });

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

            res.json({ products, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.get('/products/woourls', permit('manager', 'admin'), async (req, res) => {
        try {
            const urls = await WooGetAllProductURLS();

            if (!urls)
                return res.status(204).send();

            // Convert array to txt file, each url being in a new line and return it
            const txt = urls.join('\n');

            const file = fs.createWriteStream('public/urls.txt');
            file.on('error', function (err) {
                console.log(err);
            });

            file.write(txt);
            file.end();

            res.status(200).send();
        } catch (error) {
            console.log(error);
            // req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.get('/products/all', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            // this route is used to get all products for orders page
            const products = await Product.find({ outOfStock: { $ne: true } }).select('name code barcode type sizes retailPrice wholesalePrice quantity minQty');

            res.json(products);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.get('/products/restock', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const products = await Product.find().select('name code barcode sizes')

            res.json(products);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.post('/products/restock', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            let body = { ...req.body };
            let { products, printLabelCheck } = body;

            const doneProducts = [];

            for (const product of products) {
                if (product.quantity < 1)
                    return res.status(400).send(`Продуктът с код ${product.code} трябва да има количество по-голямо от 0`);

                // Check if product already in doneProducts
                const found = doneProducts.find(p => p._id == product._id);

                if (found) {
                    if (product.sizes.length > 0) {
                        if (product.selectedSizes.length > 0) {
                            for (const size of product.selectedSizes) {
                                found.sizes.map(s => {
                                    if (s.size === size) {
                                        s.quantity += +product.quantity;
                                    }
                                }
                                )
                            }
                            // set package quantity to smalles size quantity
                            found.quantity = Math.min(...found.sizes.map(s => s.quantity));
                        } else return res.status(400).send(`Изберете поне един размер за продукт с код ${product.code}`)
                    } else found.quantity += +product.quantity; // simple product

                    continue; // start next iteration
                }

                const dbProduct = await Product.findById(product._id);
                if (!dbProduct)
                    return res.status(400).send(`Продуктът с код ${product.code} не беше намерен в базата данни`);

                if (dbProduct.sizes.length > 0) {
                    if (product.selectedSizes.length > 0) {
                        for (const size of product.selectedSizes) {
                            dbProduct.sizes.map(s => {
                                if (s.size === size) {
                                    s.quantity += +product.quantity;
                                }
                            })
                        }
                    } else return res.status(400).send(`Изберете поне един размер за продукт с код ${product.code}`)

                    // set package quantity to smalles size quantity
                    dbProduct.quantity = Math.min(...dbProduct.sizes.map(s => s.quantity));
                } else dbProduct.quantity += +product.quantity; // simple product

                dbProduct.outOfStock = false;

                doneProducts.push(dbProduct);
            }

            doneProducts.forEach(async product => await product.save());

            if (printLabelCheck) {
                const productsToPrint = await Product.find({ _id: { $in: doneProducts.map(p => p._id) } }).select('name code barcode sizes wholesalePrice');

                // set the quantity to what we just restocked before sending to print
                for (const product of productsToPrint) {
                    // find it in products
                    const found = products.find(p => p._id == product._id);
                    product.quantity = found.quantity;
                }

                io.emit('printRestock', productsToPrint);
            }

            WooUpdateQuantityProducts(doneProducts);


            res.status(200).send();
            req.log.info(doneProducts, 'Products restocked');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.get('/products/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const product = await Product.findById(req.params.id);
            if (!product)
                return res.status(404).send('Product not found');

            res.json(product);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.post('/products', permit('user', 'manager', 'admin'), imageUploader.fields([{ name: 'image', maxCount: 1 }, { name: 'additionalImages', maxCount: 10 }]), async (req, res) => {
        try {
            const data = { ...req.body };

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

            const validation = (await validateProduct(data));

            if (validation)
                return res.status(validation.status).send(validation.error);

            if (req.files.image) {
                const mainImage = req.files.image[0].buffer;
                const mainImagePath = await uploadImg(mainImage);
                data.image = mainImagePath;

                if (req.files.additionalImages?.length > 0) {
                    const additionalImages = req.files.additionalImages.map(file => file.buffer);
                    var additionalImagesPaths = [];
                    for (const img of additionalImages)
                        additionalImagesPaths.push(await uploadImg(img));

                    data.additionalImages = additionalImagesPaths;
                } else data.additionalImages = [];
            }

            if (data.code) {
                const codeExists = await Product.findOne({ code: data.code });
                if (codeExists)
                    return res.status(400).send('Вече съществува продукт с този код');
            } else {
                var seq = await AutoIncrement.findOneAndUpdate({ name: 'product' }, { $inc: { seq: 1 } }, { new: true }).select('seq');

                if (!seq)
                    seq = await AutoIncrement.create({ name: 'product', seq: 1 });

                data.code = seq.seq;
            }

            if (!data.barcode) { // generate barcode based on product code
                const newCode = data.code.toString().padStart(12, '0'); // pad code with 0s to 12 digits
                data.barcode = `${newCode}${checkDigitEAN13(newCode.toString())}`;
            } else if (data.barcode.length !== 13)
                return res.status(400).send('Невалиден баркод. Баркодът трябва да е 13 цифри');

            const barcodeExists = await Product.findOne({ barcode: data.barcode });
            if (barcodeExists)
                return res.status(400).send('Вече съществува продукт с този баркод');

            const savedProduct = await new Product(data).save();

            if (data.hidden !== true)// product should be hidden from website
                WooCreateProduct(savedProduct);

            if (data.printLabel)
                io.emit('print', { name: savedProduct.name, code: savedProduct.code, barcode: savedProduct.barcode, wholesalePrice: savedProduct.wholesalePrice, sizes: savedProduct.sizes }, savedProduct.quantity);

            res.status(201).send();
            req.log.info(savedProduct, 'Product created');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }

    });

    productsRouter.put('/products/:id', permit('manager', 'admin'), imageUploader.fields([{ name: 'image', maxCount: 1 }, { name: 'additionalImages', maxCount: 10 }]), async (req, res) => {
        try {
            const id = req.params.id;
            const data = { ...req.body };

            if (data.noInvoice == "")
                data.noInvoice = true;
            else data.noInvoice = false;

            if (data.sizes)
                data.sizes = JSON.parse(data.sizes);

            const validation = (await validateProduct(data));

            if (validation)
                return res.status(validation.status).send(validation.error);

            const product = await Product.findById(id);

            if (!product)
                return res.status(404).send('Продуктът не е открит');

            // Check if new image was uploaded
            if (req.files.image) {
                const mainImage = req.files.image[0].buffer;
                const mainImagePath = await uploadImg(mainImage);
                data.image = mainImagePath;

                // delete original image if it exists
                fs.existsSync(`public${product.image}`) &&
                    fs.unlink(`public${product.image}`, (err) => {
                        if (err) console.error(err);
                    });
            } else if (product.image)
                data.image = product.image;

            //TODO Test what happens with images when changing on the ecommerce
            if (req.files.additionalImages?.length > 0) {
                const additionalImages = req.files.additionalImages.map(file => file.buffer);
                var additionalImagesPaths = [];
                for (const img of additionalImages)
                    additionalImagesPaths.push(await uploadImg(img));

                data.additionalImages = additionalImagesPaths;

                // delete original images
                for (const img of product.additionalImages) {
                    fs.existsSync(`public${img}`) &&
                        fs.unlink(`public${img}`, (err) => {
                            if (err) console.error(err);
                        });
                }
            } else data.additionalImages = product.additionalImages;

            if (data.code && data.code !== product.code) { // New product code was entered
                const codeExists = await Product.findOne({ code: data.code });
                if (codeExists)
                    return res.status(400).send('Вече съществува продукт с този код');
            }

            if (data.barcode && data.barcode !== product.barcode) { // New product barcode was entered
                if (data.barcode.length !== 13)
                    return res.status(400).send('Невалиден баркод. Баркодът трябва да е 13 цифри');

                const barcodeExists = await Product.findOne({ barcode: data.barcode });
                if (barcodeExists)
                    return res.status(400).send('Вече съществува продукт с този баркод');
            }

            await product.updateOne(data);
            const savedProduct = await Product.findById(id);

            if (product.hidden !== true) // if hidden then its not in the website
                WooEditProduct(product, data);

            res.status(201).json(savedProduct);

            req.log.info(savedProduct, 'Product updated');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.delete('/products/:id', permit('admin'), async (req, res) => {
        try {
            const product = await Product.findById(req.params.id);

            if (!product)
                return res.status(404).send('Product not found');

            // delete images
            if (product.image) {
                fs.existsSync(`public${product.image}`) &&
                    fs.unlink(`public${product.image}`, (err) => {
                        if (err) console.error(err);
                    });
            }

            if (product.additionalImages.length > 0)
                for (const img of product.additionalImages) {
                    fs.existsSync(`public${img}`) &&
                        fs.unlink(`public${img}`, (err) => {
                            if (err) console.error(err);
                        });
                }

            const wooId = product.wooId;

            const inDocument = await Order.findOne({ 'products.product': req.params.id });
            if (inDocument) {
                product.deleted = true;
                await product.save();
            }
            else
                await product.deleteOne();

            if (wooId) // if it has wooId, then its in the ecommerce
                WooDeleteProduct(wooId);

            res.status(204).send();

            req.log.info(product, 'Product deleted');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, productsRouter);
}