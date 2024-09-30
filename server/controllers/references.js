import { Company } from "../models/company.js";
import { Customer } from "../models/customer.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";

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
    }
}