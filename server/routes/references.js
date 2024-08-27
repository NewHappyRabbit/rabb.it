import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { Company } from "../models/company.js";
import { Customer } from "../models/customer.js";
import { User } from "../models/user.js";

export function referencesSalesRoutes() {
    const salesRouter = express.Router();

    salesRouter.get('/references/orders', permit('manager', 'admin'), async (req, res) => {
        try {
            let query = {
                $and: [{ deleted: { $ne: true } }]
            };

            const { cursor, user, from, to, type, orderType, customer, company, paymentType, unpaid, numberFrom, numberTo, product } = req.query;
            var prevCursor = null;
            var nextCursor = null;
            var limit = 5;

            cursor && query.$and.push({ _id: { $lte: cursor } });

            from && query.$and.push({ date: { $gte: from } });

            to && query.$and.push({ date: { $lte: to } });

            type && query.$and.push({ type });

            orderType && query.$and.push({ orderType });

            paymentType && query.$and.push({ paymentType });

            unpaid && query.$and.push({ unpaid: true });

            numberFrom && query.$and.push({ number: { $gte: numberFrom } });

            numberTo && query.$and.push({ number: { $lte: numberTo } });

            if (product) {
                const prod = await Product.findOne({ code: { $regex: product, $options: 'i' } }).select('_id');
                query.$and.push({ 'products.product': prod._id });
            }

            if (customer) {
                const cust = await Customer.findOne({ vat: { $regex: customer, $options: 'i' } }).select('_id');
                query.$and.push({ 'customer': cust._id });
            }

            if (company) {
                const comp = await Company.findOne({ vat: { $regex: company, $options: 'i' } }).select('_id');
                query.$and.push({ 'company': comp._id });
            }

            if (user) {
                const usr = await User.findById(user).select('_id');
                query.$and.push({ 'user': usr._id });
            }

            const orders = await Order.find(query).limit(limit).select('-receiver -sender').sort({ _id: -1 }).populate('customer company user products.product');

            if (product) {
                orders.forEach(order => {
                    order.products = order.products.filter(p => p?.product?.code === product);
                });
            }

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

                const prevSales = await Order.find(query).sort({ _id: -1 });
                prevCursor = prevSales[prevSales.length - limit + 1]?._id || null;
            }

            res.json({ orders, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, salesRouter);
}