import { Company } from "../models/company.js";
import { Customer } from "../models/customer.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";

export const ReferencesController = {
    get: async (query) => {
        const dbQuery = {
            $and: [{ deleted: { $ne: true } }]
        };

        const { print = false, cursor, user, from, to, type, orderType, customer, company, paymentType, unpaid, numberFrom, numberTo, product } = query;
        var prevCursor = null;
        var nextCursor = null;
        var limit = print === 'true' ? 0 : 5; // If printing - dont limit results

        // If printing start from first page instead at cursor
        !print && cursor && dbQuery.$and.push({ _id: { $lte: cursor } });

        from && dbQuery.$and.push({ date: { $gte: from } });

        to && dbQuery.$and.push({ date: { $lte: to } });

        type && dbQuery.$and.push({ type });

        orderType && dbQuery.$and.push({ orderType });

        paymentType && dbQuery.$and.push({ paymentType });

        unpaid && dbQuery.$and.push({ unpaid: true });

        numberFrom && dbQuery.$and.push({ number: { $gte: numberFrom } });

        numberTo && dbQuery.$and.push({ number: { $lte: numberTo } });

        if (product) {
            const prod = await Product.findOne({ code: { $regex: product, $options: 'i' } }).select('_id');
            dbQuery.$and.push({ 'products.product': prod._id });
        }

        if (customer) {
            const cust = await Customer.findOne({ vat: { $regex: customer, $options: 'i' } }).select('_id');
            dbQuery.$and.push({ 'customer': cust._id });
        }

        if (company) {
            const comp = await Company.findOne({ vat: { $regex: company, $options: 'i' } }).select('_id');
            dbQuery.$and.push({ 'company': comp._id });
        }

        if (user) {
            const usr = await User.findById(user).select('_id');
            dbQuery.$and.push({ 'user': usr._id });
        }

        const orders = await Order.find(dbQuery).limit(limit).select('-receiver -sender').sort({ _id: -1 }).populate('customer company user products.product');

        if (product) {
            orders.forEach(order => {
                order.products = order.products.filter(p => p?.product?.code === product);
            });
        }

        if (!orders || orders.length === 0) return { orders: [], prevCursor, nextCursor };

        // If printing, no need to create cursor for traversing
        if (print) return { orders };

        // get next order to generate cursor for traversing
        if (orders.length === limit)
            nextCursor = orders[orders.length - 1]._id;

        if (cursor) {
            const prevQuery = dbQuery;
            prevQuery.$and.map(q => {
                if (q._id) q._id = { $gt: cursor };
            })

            const prevSales = await Order.find(dbQuery).sort({ _id: -1 });
            prevCursor = prevSales[prevSales.length - limit + 1]?._id || null;
        }

        return { orders, prevCursor, nextCursor };
    }
}