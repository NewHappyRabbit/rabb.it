import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Order, documentTypes, paymentTypes, orderTypes } from "../models/order.js";
import { Product } from "../models/product.js";
import { Company } from "../models/company.js";
import { Customer } from "../models/customer.js";
import { AutoIncrement } from "../models/autoincrement.js";
import { WooUpdateQuantityProducts } from "../woocommerce/products.js";

async function validateOrder(data) {
    if (!data.date)
        return { status: 400, error: 'Въведете дата' };

    if (!data.type || Object.keys(documentTypes).indexOf(data.type) === -1)
        return { status: 400, error: 'Невалиден тип на документа' };

    if (!data.customer)
        return { status: 400, error: 'Въведете клиент' };

    const existingCustomer = await Customer.findById(data.customer);

    if (!existingCustomer)
        return { status: 400, error: 'Клиентът не съществува' };

    if (!data.orderType || Object.keys(orderTypes).indexOf(data.orderType) === -1)
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

export function ordersRoutes() {
    const ordersRouter = express.Router();

    ordersRouter.get('/orders/params', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            var data = {
                orderTypes,
                paymentTypes,
                documentTypes
            };

            res.json(data);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.get('/orders', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            let query = {
                $and: [{ deleted: { $ne: true } }]
            };

            const { cursor, from, to, type, orderType, customer, company, paymentType, unpaid, number } = req.query;
            var prevCursor = null;
            var nextCursor = null;
            var limit = 15;

            cursor && query.$and.push({ _id: { $lte: cursor } });

            number && query.$and.push({ number });

            from && query.$and.push({ date: { $gte: from } });

            to && query.$and.push({ date: { $lte: to } });

            type && query.$and.push({ type });

            orderType && query.$and.push({ orderType });

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

            const orders = await Order.find(query).limit(limit).select('-products -receiver -sender').sort({ _id: -1 }).populate('customer company');

            if (!orders || orders.length === 0)
                return res.json({ orders: [], prevCursor, nextCursor });

            // get next order to generate cursor for traversing
            if (orders.length === limit)
                nextCursor = orders[orders.length - 1]._id;

            if (cursor) {
                const prevQuery = query;
                prevQuery.$and.map(q => {
                    if (q._id) q._id = { $gt: cursor };
                })

                const prevOrders = await Order.find(query).sort({ _id: -1 });
                prevCursor = prevOrders[prevOrders.length - limit + 1]?._id || null;
            }

            res.json({ orders, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.get('/orders/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const order = await Order.findById(req.params.id).populate('products.product customer company');

            if (!order)
                return res.status(404).send('Продажбата не е намерена');

            res.json(order);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.post('/orders', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const data = { ...req.body };

            const validation = await validateOrder(data);

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

                    if (data.orderType === 'wholeorder') {
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

            const orderId = await new Order(data).save();

            WooUpdateQuantityProducts(doneProducts);

            const orderData = await Order.findById(orderId).populate('customer company products.product');
            res.status(201).json(orderData);
            req.log.info(orderData, 'New order created');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.put('/orders/:id', permit('manager', 'admin'), async (req, res) => {
        try {
            const data = req.body

            const validation = await validateOrder(data);

            if (validation)
                return res.status(validation.status).send(validation.error);

            const id = req.params.id;
            const order = await Order.findById(id);
            if (!order)
                return res.status(404).send('Документът не е намерен');

            // Check if sender and receiver were changed
            if (data.sender !== order.sender) {
                const company = await Company.findById(data.company);

                if (!company)
                    return res.status(404).send('Обектът не е намерен');

                if (!company.senders)
                    company.senders = [data.sender];

                if (!company.senders.includes(data.sender))
                    company.senders.push(data.sender);
                await company.save();
            }

            if (data.receiver !== order.receiver) {
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
                    const qtyDiff = product.quantity - (order.products.find(p => p.product == product.product)?.quantity || 0);

                    if (order.orderType === 'wholeorder') {
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
                    } else if (order.orderType === 'retail') {
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
            order.products.forEach(async product => {
                // if product is in db
                if (product.product && !data.products.find(p => p.product == product.product)) {
                    // Check if product already in doneProducts
                    const found = doneProducts.find(p => p._id == product._id);

                    const existingProduct = found || await Product.findById(product.product);
                    if (order.orderType === 'wholeorder') {
                        //return quantity to quantity
                        existingProduct.quantity += product.quantity; // to quantity
                        if (existingProduct.sizes.length > 0)
                            existingProduct.sizes.forEach(size => { // to each size
                                size.quantity += product.quantity;
                            });

                        existingProduct.outOfStock = false;
                    } else if (order.orderType === 'retail') {
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
            if (data.company !== order.company.toString() || data.type !== order.type) {
                var seq = await AutoIncrement.findOneAndUpdate({ name: data.type, company: data.company }, { $inc: { seq: 1 } }, { new: true }).select('seq');

                if (!seq)
                    seq = await AutoIncrement.create({ name: data.type, company: data.company, seq: 1 });

                data.number = seq.seq;
            }

            await Order.findByIdAndUpdate(id, data);

            const orderData = await Order.findById(id).populate('customer company products.product');
            res.status(201).json(orderData);
            req.log.info(orderData, 'Order updated');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    ordersRouter.delete('/orders/:id', permit('admin'), async (req, res) => {
        try {
            const id = req.params.id;
            const order = await Order.findById(id);

            if (!order)
                return res.status(404).send('Документът не е намерен');

            // Return quantity to products
            order.products.forEach(async product => {
                if (order.orderType === 'wholeorder' && product.product) {
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
                } else if (order.orderType === 'retail' && product.product) {
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

            order.deleted = true;
            await order.save();

            res.status(204).send();
            req.log.info(order, 'Order deleted');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, ordersRouter);
}