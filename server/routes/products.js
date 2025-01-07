import { permit } from "../middleware/auth.js";
import { app, basePath, io } from '../app.js';
import express from 'express';
import { Product } from "../models/product.js";
import fs from 'fs';
import { tempWooUpdateAttributes, WooCreateProduct, WooDeleteProduct, WooEditProduct, WooUpdateQuantityProducts } from "../woocommerce/products.js";
import { imageUploader } from "../controllers/common.js";
import { ProductController } from "../controllers/products.js";
import { WooCommerce_Shops } from "../config/woocommerce.js";

export function productSockets(socket) {
    socket.on('disconnect', () => {
        // On disconnect, check if pc with printer is connected
        io.emit('remotePrinter', io.sockets.adapter.rooms.get("printer") !== undefined);
    });

    socket.on('remotePrinter', () => {
        // This is activated when any client asks the server if there is a printer connected
        // Emit to all clients just in case there was a change
        io.emit('remotePrinter', io.sockets.adapter.rooms.get("printer") !== undefined);
    });

    socket.on('printerConnected', async () => {
        // When a PC with a printer connects, add it to a room called "printer" and send print commands only to that room
        socket.join('printer');

        io.emit('remotePrinter', io.sockets.adapter.rooms.get("printer") !== undefined);
    })

    socket.on('send-print', (product, quantity) => {
        if (io.sockets.adapter.rooms.get("printer") === undefined) return; // if no pc with printer connected, do nothing
        if (!product || !product.name || !product.code || !product.barcode || !product.wholesalePrice || !quantity) return;
        const minifiedProduct = {
            name: product.name,
            code: product.code,
            barcode: product.barcode,
            wholesalePrice: product.wholesalePrice,
        }

        if (product.sizes?.length) {
            minifiedProduct.sizes = product.sizes;
            minifiedProduct.multiplier = product.multiplier;
        }

        io.in('printer').emit('print', minifiedProduct, quantity);
    });
}

export function productsRoutes() {
    const productsRouter = express.Router();

    productsRouter.post('/productstempsave', permit('user', 'manager', 'admin'), async (req, res) => {
        //FIXME DELETE THIS ROUTE AFTER ALL PRODUCTS ARE SAVED WITH ATTRIBUTES
        try {
            const { status, doneProducts } = await ProductController.saveTemp(req.body);
            if (status !== 200) return res.status(status).send('ERROR');
            tempWooUpdateAttributes(doneProducts);
            res.status(200).send('ok');
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    })

    productsRouter.get('/products/find', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { search, filter } = req.query;
            const { product, status, message } = await ProductController.find({ search, filter });
            if (status !== 200)
                return res.status(status).send(message);

            res.json(product);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    })

    productsRouter.get('/products', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { pageSize = 15, pageNumber = 1, search, onlyHidden, onlyOutOfStock, onlyOpenedPackages, page } = req.query;

            const { count, products, pageCount, status, message } = await ProductController.get({ page, pageSize, pageNumber, search, onlyHidden, onlyOpenedPackages, onlyOutOfStock });
            if (status !== 200)
                return res.status(status).send(message);

            res.json({ count, products, pageCount });
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.get('/products/woourls', permit('manager', 'admin'), async (req, res) => {
        try {
            const hidden = req.query.hidden === 'true';
            //FIXME
            const productsURLS = await Product.find({ outOfStock: { $ne: true }, "woocommerce.permalink": { $exists: true }, hidden }).select('woocommerce.permalink -_id').lean();

            const urls = productsURLS.map(p => p.woocommerce?.find(el => el.woo_url === WooCommerce_Shops.find(shop => shop.custom.type === 'wholesale')).permalink);

            //TODO Add test for this in wooCommerce tests instead to productController
            if (!urls)
                return res.status(204).send();

            // Convert array to txt file, each url being in a new line and return it
            const txt = urls.join('\n');

            const file = fs.createWriteStream('public/urls.txt');
            file.on('error', function (err) {
                console.error(err);
            });

            file.write(txt);
            file.end();

            res.status(200).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.get('/products/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { product, status, message } = await ProductController.getById(req.params.id);
            if (status !== 200)
                return res.status(status).send(message);

            res.json(product);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.post('/products', permit('user', 'manager', 'admin'), imageUploader.fields([{ name: 'image', maxCount: 1 }, { name: 'additionalImages', maxCount: 10 }]), async (req, res) => {
        try {
            const data = { ...req.body };
            const files = req.files;

            const { product, status, message } = await ProductController.post({ data, files });
            if (status !== 201)
                return res.status(status).send(message);

            if (data.hidden === false)// if product should be hidden from website
                WooCreateProduct(product);

            // if no pc with printer connected, do nothing
            if (data.printLabel && io.sockets.adapter.rooms.get("printer") !== undefined)
                io.in('printer').emit('print', { name: product.name, code: product.code, barcode: product.barcode, wholesalePrice: product.wholesalePrice, sizes: product.sizes, multiplier: product.multiplier }, product.quantity);

            res.status(status).json(product);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }

    });

    productsRouter.post('/products/restock', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            let body = { ...req.body };
            let { products, printLabelCheck } = body;

            const { doneProducts, status, message } = await ProductController.restock(products);
            if (status !== 200)
                return res.status(status).send(message);

            // if no pc with printer connected, do nothing
            if (printLabelCheck && io.sockets.adapter.rooms.get("printer") !== undefined) {
                const productsToPrint = await Product.find({ _id: { $in: doneProducts.map(p => p._id) } }).select('name code barcode sizes wholesalePrice multiplier');

                // set the quantity to what we just restocked before sending to print
                for (const product of productsToPrint) {
                    // find it in products
                    const found = products.find(p => p._id == product._id);
                    product.quantity = found.quantity;
                }

                io.in('printer').emit('printRestock', productsToPrint);
            }

            WooUpdateQuantityProducts(doneProducts);

            res.status(status).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.put('/products/markOutOfStock/:id', permit('manager', 'admin'), async (req, res) => {
        try {
            const id = req.params.id;

            const { product, status, message } = await ProductController.markOutOfStock(id);
            if (status !== 201)
                return res.status(status).send(message);

            WooUpdateQuantityProducts([product]);

            res.status(status).json(product);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.put('/products/:id', permit('manager', 'admin'), imageUploader.fields([{ name: 'image', maxCount: 1 }, { name: 'additionalImages', maxCount: 10 }]), async (req, res) => {
        try {
            const id = req.params.id;
            const data = { ...req.body };
            const files = req.files;

            const { product, status, message } = await ProductController.put({ id, data, files });
            if (status !== 201)
                return res.status(status).send(message);

            if (product.hidden === false && product?.woocommerce?.length) // if hidden then its not in the website
                WooEditProduct(product);
            else if (product.hidden === true && product?.woocommerce?.length) {
                console.log('Product changed from non-hidden to hidden -> Deleting it from WooCommerce!');
                // Product was probably changed from non-hidden to hidden
                await WooDeleteProduct(product.woocommerce); // Delete from Woo
                product.woocommerce = undefined;
                if (product.sizes.length > 0) {
                    for (let size of product.sizes) {
                        size.woocommerce = undefined;
                    }
                }
                await product.save();
            } else if (product.hidden === false && !product.woocommerce.length) {
                console.log('Product changed from hidden to non-hidden -> Creating it in WooCommerce!');
                // Product was probably changed from hidden to non-hidden
                WooCreateProduct(product);
            }

            res.status(status).json(product);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    productsRouter.delete('/products/:id', permit('admin'), async (req, res) => {
        try {
            const { wooData, status, message } = await ProductController.delete(req.params.id);
            if (status !== 204)
                return res.status(status).send(message);

            if (wooData.length) // if it has wooId, then its in the ecommerce
                WooDeleteProduct(wooData);

            res.status(status).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, productsRouter);
}