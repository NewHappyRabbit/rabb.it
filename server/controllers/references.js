import { Order } from "../models/order.js";
import { Product } from "../models/product.js";

export const ReferencesController = {
    get: async ({ pageNumber, pageSize, print = false, user, from, to, type, orderType, customer, company, paymentType, unpaid, numberFrom, numberTo, product }) => {
        const dbQuery = {
            $and: [{ deleted: { $ne: true } }]
        };

        from && dbQuery.$and.push({ date: { $gte: from } });

        to && dbQuery.$and.push({ date: { $lte: to } });

        type && dbQuery.$and.push({ type });

        orderType && dbQuery.$and.push({ orderType });

        paymentType && dbQuery.$and.push({ paymentType });

        unpaid && dbQuery.$and.push({ unpaid: true });

        numberFrom && dbQuery.$and.push({ number: { $gte: numberFrom } });

        numberTo && dbQuery.$and.push({ number: { $lte: numberTo } });

        customer && dbQuery.$and.push({ customer });

        company && dbQuery.$and.push({ company });

        user && dbQuery.$and.push({ user });

        product && dbQuery.$and.push({ 'products.product': product });

        let orders;
        if (print)
            orders = await Order.find(dbQuery).select('-receiver -sender').sort({ _id: -1 }).populate('customer company user products.product');
        else orders = await Order.find(dbQuery).limit(pageSize).skip(pageSize * (pageNumber - 1)).select('-receiver -sender').sort({ _id: -1 }).populate('customer company user products.product');
        const count = await Order.countDocuments(dbQuery);
        const pageCount = Math.ceil(count / pageSize);

        if (product) {
            orders.forEach(order => {
                order.products = order.products.filter(p => p?.product?.code === product);
            });
        }

        if (!orders || orders.length === 0) return { orders: [], count, pageCount };

        return { orders, count, pageCount };
    },
    getAccounting: async ({ from, to, company }) => {
        const query = { type: { $in: ['credit', 'invoice'] }, deleted: { $ne: true } };

        if (from || to) {
            query.date = {
                ...(from && { $gte: new Date(from).toISOString() }),
                ...(to && { $lte: new Date(to).toISOString() })
            }
        }

        if (company)
            query.company = company;

        const orders = await Order.find(query).select('type number customer company total date paymentType').sort({ _id: -1 }).populate('customer company');
        return { orders };
    },
    getStocks: async ({ pageSize, pageNumber, print }) => {
        const dbQuery = { deleted: false, outOfStock: false }
        const skip = parseInt(pageSize * (Number(pageNumber) - 1)) || 0;
        let products;
        if (print)
            products = await Product.find(dbQuery).sort({ category: 1 });
        else products = await Product.find(dbQuery).sort({ category: 1, _id: -1 }).skip(skip).limit(pageSize);
        const count = await Product.countDocuments(dbQuery);
        const pageCount = Math.ceil(count / pageSize);

        if (!products || products.length === 0) return { products: [], count, pageCount };

        return { products, count, pageCount };
    }
}