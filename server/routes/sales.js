import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Sale, documentTypes, paymentTypes, saleTypes } from "../models/sale.js";
import { Product } from "../models/product.js";
import { Company } from "../models/company.js";
import { Customer } from "../models/customer.js";
import { AutoIncrement } from "../models/autoincrement.js";
import { WooUpdateQuantityProducts } from "../woocommerce/products.js";

async function validateSale(data) {
    if (!data.date)
        return { status: 400, error: 'Въведете дата' };

    if (!data.type || Object.keys(documentTypes).indexOf(data.type) === -1)
        return { status: 400, error: 'Невалиден тип на документа' };

    if (!data.customer)
        return { status: 400, error: 'Въведете клиент' };

    const existingCustomer = await Customer.findById(data.customer);

    if (!existingCustomer)
        return { status: 400, error: 'Клиентът не съществува' };

    if (!data.saleType || Object.keys(saleTypes).indexOf(data.saleType) === -1)
        return { status: 400, error: 'Въведете тип на продажбата' };

    if (!data.products || data.products.length === 0)
        return { status: 400, error: 'Въведете продукти' };

    for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];

        if (product.product) {
            const existingProduct = await Product.findById(product.product);

            if (!existingProduct)
                return { status: 400, error: 'Продуктът не съществува' };
        }

        if (!product.product && !product.name)
            return { status: 400, error: 'Въведете продукт' };

        if (!product.quantity)
            return { status: 400, error: 'Въведете количество' };

        if (product.quantity < 1)
            return { status: 400, error: 'Количеството трябва да е по-голямо от 0' };

        if (!product.price)
            return { status: 400, error: 'Въведете цена' };

        if (product.price < 0)
            return { status: 400, error: 'Цената трябва да е по-голяма или равна на 0' };

        if (product.discount && (product.discount < 0 || product.discount > 100))
            return { status: 400, error: 'Отстъпката трябва да е в границите между 0 и 100' };
    }

    if (!data.paymentType || Object.keys(paymentTypes).indexOf(data.paymentType) === -1)
        return { status: 400, error: 'Невалиден тип на плащане' };

    if (data.paidAmount < 0)
        return { status: 400, error: 'Платената сума трябва да е по-голяма или равна на 0' };

    if (!data.company)
        return { status: 400, error: 'Въведете фирма' };

    const existingCompany = await Company.findById(data.company);

    if (!existingCompany)
        return { status: 400, error: 'Фирмата не съществува' };

    if (!data.receiver)
        return { status: 400, error: 'Въведете получател' };

    if (!data.sender)
        return { status: 400, error: 'Въведете изпращач' };
}

export function salesRoutes() {
    const salesRouter = express.Router();

    salesRouter.get('/sales/params', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            var data = {
                saleTypes,
                paymentTypes,
                documentTypes
            };

            res.json(data);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    salesRouter.get('/sales', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            let query = {
                $and: [{ deleted: { $ne: true } }]
            };

            const { cursor, from, to, type, saleType, customer, company, paymentType, unpaid, number } = req.query;
            var prevCursor = null;
            var nextCursor = null;
            var limit = 15;

            cursor && query.$and.push({ _id: { $lte: cursor } });

            number && query.$and.push({ number });

            from && query.$and.push({ date: { $gte: from } });

            to && query.$and.push({ date: { $lte: to } });

            type && query.$and.push({ type });

            saleType && query.$and.push({ saleType });

            paymentType && query.$and.push({ paymentType });

            unpaid && query.$and.push({ unpaid: true });

            if (customer) {
                const cust = await Customer.findOne({ vat: { $regex: customer, $options: 'i' } }).select('_id');
                query.$and.push({ 'customer': cust._id });
            }

            if (company) {
                const comp = await Company.findOne({ vat: { $regex: company, $options: 'i' } }).select('_id');
                query.$and.push({ 'company': comp._id });
            }

            const sales = await Sale.find(query).limit(limit).select('-products -receiver -sender').sort({ _id: -1 }).populate('customer company');

            if (!sales || sales.length === 0)
                return res.json({ sales: [], prevCursor, nextCursor });

            // get next sale to generate cursor for traversing
            if (sales.length === limit)
                nextCursor = sales[sales.length - 1]._id;

            if (cursor) {
                const prevQuery = query;
                prevQuery.$and.map(q => {
                    if (q._id) q._id = { $gt: cursor };
                })

                const prevSales = await Sale.find(query).sort({ _id: -1 });
                prevCursor = prevSales[prevSales.length - limit + 1]?._id || null;
            }

            res.json({ sales, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    salesRouter.get('/sales/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const sale = await Sale.findById(req.params.id).populate('products.product customer company');

            if (!sale)
                return res.status(404).send('Продажбата не е намерена');

            res.json(sale);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    salesRouter.post('/sales', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const data = { ...req.body };

            const validation = await validateSale(data);

            if (validation)
                return res.status(validation.status).send(validation.error);

            // Add sender to company
            const company = await Company.findById(data.company);

            if (!company.senders)
                company.senders = [data.sender];

            if (!company.senders.includes(data.sender))
                company.senders.push(data.sender);

            await company.save();

            // Add receiver to customer
            const customer = await Customer.findById(data.customer);

            if (!customer.receivers)
                company.receivers = [data.receiver];

            if (!customer.receivers.includes(data.receiver))
                customer.receivers.push(data.receiver);

            await customer.save();

            data.user = JSON.parse(req.cookies.user).id;

            var total = 0;
            var doneProducts = [];
            // Calculate total of products and remove quantity from stock
            for (let i = 0; i < data.products.length; i++) {
                const product = data.products[i];

                if (product.product) {
                    const existingProduct = await Product.findById(product.product);

                    if (data.saleType === 'wholesale') {
                        if (existingProduct.quantity < product.quantity) // check if there are enough quantity
                            return res.status(400).send(`Няма достатъчно пакети от продукта: ${existingProduct.name} [${existingProduct.code}]`);

                        existingProduct.quantity -= product.quantity; // from quantity

                        if (existingProduct.sizes.length > 0) { // if variable product
                            existingProduct.sizes.forEach(size => { // from each size
                                size.quantity -= product.quantity;
                            });

                            // if no quantity of any size is left, mark as out of stock
                            if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                                existingProduct.outOfStock = true;
                        } else if (existingProduct.quantity <= 0) {
                            existingProduct.outOfStock = true;
                        }

                    } else {
                        if (existingProduct.sizes.length > 0 && existingProduct.sizes.filter(size => size.size === product.size)[0].quantity < product.quantity) // check if there are enough quantity of size
                            return res.status(400).send(`Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]`);


                        if (existingProduct.sizes.length === 0) { //simple product
                            existingProduct.quantity -= product.quantity; // from quantity

                            // if no quantity is left, mark as out of stock
                            if (existingProduct.quantity === 0)
                                existingProduct.outOfStock = true;
                        } else {
                            existingProduct.sizes.filter(size => size.size === product.size)[0].quantity -= product.quantity; // from size

                            // find lowest size value and set as quantity value
                            existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));

                            // if no quantity of any size is left, mark as out of stock
                            if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                                existingProduct.outOfStock = true;
                        }
                    }
                    doneProducts.push(existingProduct);
                }
                total += (product.quantity * product.price) * (1 - product.discount / 100);
            }

            // if all goes well, save all products
            doneProducts.forEach(async product => await product.save());
            data.total = total.toFixed(2);

            data.unpaid = (data.paidAmount || 0).toFixed(2) < total.toFixed(2);

            var seq = await AutoIncrement.findOneAndUpdate({ name: data.type, company }, { $inc: { seq: 1 } }, { new: true }).select('seq');

            if (!seq)
                seq = await AutoIncrement.create({ name: data.type, company, seq: 1 });

            data.number = seq.seq;

            const saleId = await new Sale(data).save();

            WooUpdateQuantityProducts(doneProducts);

            const saleData = await Sale.findById(saleId).populate('customer company products.product');
            res.status(201).json(saleData);
            req.log.info(saleData, 'New sale created');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    salesRouter.put('/sales/:id', permit('manager', 'admin'), async (req, res) => {
        try {
            const data = req.body

            const validation = await validateSale(data);

            if (validation)
                return res.status(validation.status).send(validation.error);

            const id = req.params.id;
            const sale = await Sale.findById(id);
            if (!sale)
                return res.status(404).send('Документът не е намерен');

            // Check if sender and receiver were changed
            if (data.sender !== sale.sender) {
                const company = await Company.findById(data.company);

                if (!company)
                    return res.status(404).send('Обектът не е намерен');

                if (!company.senders)
                    company.senders = [data.sender];

                if (!company.senders.includes(data.sender))
                    company.senders.push(data.sender);
                await company.save();
            }

            if (data.receiver !== sale.receiver) {
                const customer = await Customer.findById(data.customer);

                if (!customer)
                    return res.status(404).send('Партньорът не е намерен');

                if (!customer.receivers)
                    customer.receivers = [data.receiver];

                if (!customer.receivers.includes(data.receiver))
                    customer.receivers.push(data.receiver);

                await customer.save();
            }

            data.user = JSON.parse(req.cookies.user).id;

            var total = 0;

            var doneProducts = [];
            // Calculate total of products and remove/add quantity to stock
            for (let i = 0; i < data.products.length; i++) {
                const product = data.products[i];

                if (product.product) { // If product in db
                    const existingProduct = await Product.findById(product.product);
                    const qtyDiff = product.quantity - (sale.products.find(p => p.product == product.product)?.quantity || 0);

                    if (sale.saleType === 'wholesale') {
                        // if qty was added
                        if (qtyDiff > 0) {
                            if (existingProduct.quantity < qtyDiff) // check if there are enough quantity
                                return res.status(400).send(`Няма достатъчно пакети от продукта: ${existingProduct.name} [${existingProduct.code}]`);

                            existingProduct.quantity -= qtyDiff; // from quantity

                            if (existingProduct.sizes.length) { // variable product
                                existingProduct.sizes.forEach(size => { // from each size
                                    size.quantity -= qtyDiff;
                                });

                                // if no quantity of any size is left, mark as out of stock
                                if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                                    existingProduct.outOfStock = true;
                            } else if (existingProduct.quantity <= 0) // simple product
                                existingProduct.outOfStock = true;

                        } else if (qtyDiff < 0) { // if qty was removed
                            existingProduct.quantity -= qtyDiff; // from quantity
                            if (existingProduct.sizes.length) // variable product
                                existingProduct.sizes.forEach(size => { // from each size
                                    size.quantity -= qtyDiff;
                                });
                            existingProduct.outOfStock = false;

                        }
                    } else if (sale.saleType === 'retail') {
                        if (qtyDiff > 0) {
                            if (product.size && existingProduct.sizes.filter(size => size.size === product.size)[0].quantity < qtyDiff) // check if there are enough quantity of size
                                return res.status(400).send(`Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]`);
                            else if (existingProduct.sizes.length === 0 && existingProduct.quantity < qtyDiff) // check if there are enough quantity
                                return res.status(400).send(`Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]`);

                            if (existingProduct.sizes.length > 0) { // variable product
                                existingProduct.sizes.filter(size => size.size === product.size)[0].quantity -= qtyDiff; // from size

                                existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));

                                // if no quantity of any size is left, mark as out of stock
                                if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                                    existingProduct.outOfStock = true;
                            } else {
                                existingProduct.quantity -= qtyDiff; // from quantity
                                if (existingProduct.quantity <= 0)
                                    existingProduct.outOfStock = true;
                            }
                        } else if (qtyDiff < 0) {
                            if (existingProduct.sizes.length) { // variable product
                                existingProduct.sizes.filter(size => size.size === product.size)[0].quantity -= qtyDiff; // from size

                                // find lowest size value and set as quantity value
                                existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));
                            } else
                                existingProduct.quantity -= qtyDiff; // from quantity

                            existingProduct.outOfStock = false;
                        }

                    }
                    doneProducts.push(existingProduct);
                }

                total += (product.quantity * product.price) * (1 - product.discount / 100);
            }

            // if all goes well, save all products
            doneProducts.forEach(async product => await product.save());
            doneProducts = [];
            // Check if any products were completely removed
            sale.products.forEach(async product => {
                // if product is in db
                if (product.product && !data.products.find(p => p.product == product.product)) {
                    // Check if product already in doneProducts
                    const found = doneProducts.find(p => p._id == product._id);

                    const existingProduct = found || await Product.findById(product.product);
                    if (sale.saleType === 'wholesale') {
                        //return quantity to quantity
                        existingProduct.quantity += product.quantity; // to quantity
                        if (existingProduct.sizes.length > 0)
                            existingProduct.sizes.forEach(size => { // to each size
                                size.quantity += product.quantity;
                            });

                        existingProduct.outOfStock = false;
                    } else if (sale.saleType === 'retail') {
                        if (existingProduct.sizes.length > 0) { // variable, return size
                            existingProduct.sizes.filter(size => size.size === product.size)[0].quantity += product.quantity; // to size

                            // set product quantity to lowest size value
                            existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));
                        } else
                            existingProduct.quantity += product.quantity;

                        existingProduct.outOfStock = false;
                    }

                    if (!found)
                        doneProducts.push(existingProduct);
                }
            });

            // if all goes well, save all products
            doneProducts.forEach(async product => await product.save());

            data.total = total.toFixed(2);

            data.unpaid = (data.paidAmount || 0).toFixed(2) < total.toFixed(2);

            // Check if company or document type was changed and change document number
            if (data.company !== sale.company.toString() || data.type !== sale.type) {
                var seq = await AutoIncrement.findOneAndUpdate({ name: data.type, company: data.company }, { $inc: { seq: 1 } }, { new: true }).select('seq');

                if (!seq)
                    seq = await AutoIncrement.create({ name: data.type, company: data.company, seq: 1 });

                data.number = seq.seq;
            }

            await Sale.findByIdAndUpdate(id, data);

            const saleData = await Sale.findById(id).populate('customer company products.product');
            res.status(201).json(saleData);
            req.log.info(saleData, 'Sale updated');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    salesRouter.delete('/sales/:id', permit('admin'), async (req, res) => {
        try {
            const id = req.params.id;
            const sale = await Sale.findById(id);

            if (!sale)
                return res.status(404).send('Документът не е намерен');

            // Return quantity to products
            sale.products.forEach(async product => {
                if (sale.saleType === 'wholesale' && product.product) {
                    const existingProduct = await Product.findById(product.product);
                    if (existingProduct.sizes.length > 0) {
                        existingProduct.sizes.forEach(size => { // to each size
                            size.quantity += product.quantity;
                        });

                        // set product quantity to lowest size value
                        existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));
                    } else
                        existingProduct.quantity += product.quantity; // to quantity


                    existingProduct.outOfStock = false;
                    await existingProduct.save();
                } else if (sale.saleType === 'retail' && product.product) {
                    const existingProduct = await Product.findById(product.product);

                    if (existingProduct.sizes.length > 0) {
                        existingProduct.sizes.filter(size => size.size === product.size)[0].quantity += product.quantity; // to size

                        // set product quantity to lowest size value
                        existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));
                    } else
                        existingProduct.quantity += product.quantity; // to quantity


                    existingProduct.outOfStock = false;
                    await existingProduct.save();
                }
            });

            sale.deleted = true;
            await sale.save();

            res.status(204).send();
            req.log.info(sale, 'Sale deleted');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, salesRouter);
}