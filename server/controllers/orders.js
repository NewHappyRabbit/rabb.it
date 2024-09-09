import { Order, documentTypes, paymentTypes, orderTypes } from "../models/order.js";
import { Customer } from "../models/customer.js";
import { Product } from "../models/product.js";
import { Company } from "../models/company.js";
import { AutoIncrement } from "../models/autoincrement.js";

async function validateOrder(data) {
    if (!data.date)
        return { status: 400, message: 'Въведете дата' };

    if (!data.type || Object.keys(documentTypes).indexOf(data.type) === -1)
        return { status: 400, message: 'Невалиден тип на документа' };

    if (!data.customer)
        return { status: 400, message: 'Въведете клиент' };

    const existingCustomer = await Customer.findById(data.customer);

    if (!existingCustomer)
        return { status: 400, message: 'Клиентът не съществува' };

    if (!data.orderType || Object.keys(orderTypes).indexOf(data.orderType) === -1)
        return { status: 400, message: 'Въведете тип на продажбата' };

    if (!data.products || data.products.length === 0)
        return { status: 400, message: 'Въведете продукти' };

    for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];

        const existingProduct = await Product.findById(product.product);
        if (product.product) {
            if (!existingProduct)
                return { status: 400, message: 'Продуктът не съществува' };

            if (data.orderType === 'wholesale' && product.selectedSizes?.length === 0) // atleast 1 size must be selected
                return { status: 400, message: `Трябва да изберете поне 1 размер за продукта ${existingProduct.name} [${existingProduct.code}]` };
        }

        if (!product.product && !product.name)
            return { status: 400, message: 'Въведете продукт' };

        // Variable existing product
        if (data.orderType === 'wholesale' && existingProduct && product.selectedSizes?.length === 0)
            return { status: 400, message: `Трябва да изберете поне 1 размер за продукта: ${existingProduct.name} [${existingProduct.code}]` };

        if (!product.quantity || product.quantity <= 0)
            return { status: 400, message: `Въведете количество за продукта: ${product.name}` };

        if (!product.price)
            return { status: 400, message: 'Въведете цена' };

        if (product.price < 0)
            return { status: 400, message: 'Цената трябва да е по-голяма или равна на 0' };

        if (product.discount && (product.discount < 0 || product.discount > 100))
            return { status: 400, message: 'Отстъпката трябва да е в границите между 0 и 100' };

        if (!product.unitOfMeasure)
            return { status: 400, message: 'Липсва мярка за артикул' };
    }

    if (!data.paymentType || Object.keys(paymentTypes).indexOf(data.paymentType) === -1)
        return { status: 400, message: 'Невалиден тип на плащане' };

    if (data.paidAmount < 0)
        return { status: 400, message: 'Платената сума трябва да е по-голяма или равна на 0' };

    if (!data.company)
        return { status: 400, message: 'Въведете фирма' };

    const existingCompany = await Company.findById(data.company);

    if (!existingCompany)
        return { status: 400, message: 'Фирмата не съществува' };

    if (!data.receiver)
        return { status: 400, message: 'Въведете получател' };

    if (!data.sender)
        return { status: 400, message: 'Въведете изпращач' };
}

async function removeProductsQuantities({ data, returnedProducts }) {
    var total = 0;
    var updatedProducts = returnedProducts ? [...returnedProducts] : []; // If PUT, get returnedProducts quantities and save them here at the end if all is good
    // Calculate total and remove quantity from stock
    for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];

        if (!product.product) {
            total += (product.quantity * product.price) * (1 - product.discount / 100);
            continue;
        }

        // Check if in doneProducts first, otherwise search db
        const alreadyInDoneProducts = updatedProducts.find(p => p._id.toString() === product.product.toString());
        const productInDb = await Product.findById(product.product);
        const existingProduct = alreadyInDoneProducts || productInDb;

        // Wholesale + Variable product
        if (data.orderType === 'wholesale' && existingProduct.sizes.length > 0) {
            // Remove quantity from each selected size (can be all of them, or just some (sell open package))
            for (let size of product.selectedSizes) {
                // Check if there is enough quantity of selected size
                if (existingProduct.sizes.filter(s => s.size === size)[0].quantity < product.quantity)
                    return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} (${size}) [${existingProduct.code}]! Количество на склад: ${existingProduct.sizes.filter(s => s.size === size)[0].quantity}` };

                existingProduct.sizes.filter(s => s.size === size)[0].quantity -= product.quantity;
            }

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));

            // If no quantity of any size is left, mark as out of stock
            if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                existingProduct.outOfStock = true;
        }

        // Wholesale + Simple product
        if (data.orderType === 'wholesale' && existingProduct?.sizes?.length === 0) {
            // Check if there is enough quantity

            if (existingProduct.quantity < product.quantity)
                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]! Количество на склад: ${existingProduct.quantity}` };

            existingProduct.quantity -= product.quantity;

            // If no quantity left, mark as out of stock
            if (existingProduct.quantity <= 0) existingProduct.outOfStock = true;
        }

        // Retail + Variable product
        if (data.orderType === 'retail' && existingProduct.sizes.length > 0) {
            // Check if there is enough quantity
            if (existingProduct.sizes.filter(size => size.size === product.size)[0].quantity < product.quantity)
                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} (${product.size}) [${existingProduct.code}]! Количество на склад: ${existingProduct.sizes.filter(size => size.size === product.size)[0].quantity}` };

            existingProduct.sizes.filter(size => size.size === product.size)[0].quantity -= product.quantity;

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));

            // If no quantity of any size is left, mark as out of stock
            if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                existingProduct.outOfStock = true;
        }

        // Retail + Simple product
        if (data.orderType === 'retail' && existingProduct?.sizes?.length === 0) {
            // Check if there is enough quantity
            if (existingProduct.quantity < product.quantity)
                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]! Количество на склад: ${existingProduct.quantity}` };

            existingProduct.quantity -= product.quantity;

            // If no quantity left, mark as out of stock
            if (existingProduct.quantity <= 0) existingProduct.outOfStock = true;
        }

        // Add product to array to save later
        if (!alreadyInDoneProducts) updatedProducts.push(existingProduct);

        total += (product.quantity * product.price) * (1 - product.discount / 100);
    }

    // Update all products in paralel with promies
    await Promise.all(updatedProducts.map(product => product.save()));
    total = total.toFixed(2);

    return { total, updatedProducts };
}

async function returnProductsQuantities(data) {
    var savedProducts = [];

    for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];

        if (!product.product) continue; // if product not in db, skip

        // Check if in doneProducts first, otherwise search db
        const alreadyInDoneProducts = savedProducts.find(p => p._id.toString() === product.product.toString());
        const productInDb = await Product.findById(product.product);
        const existingProduct = alreadyInDoneProducts || productInDb;

        // Wholesale + Variable product
        if (data.orderType === 'wholesale' && existingProduct.sizes.length > 0) {
            // Return quantity to each selected size (can be all of them, or just some (sell open package))
            for (let size of product.selectedSizes) existingProduct.sizes.filter(s => s.size === size)[0].quantity += product.quantity;

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));

            existingProduct.outOfStock = false;
        }

        // Wholesale + Simple product
        if (data.orderType === 'wholesale' && existingProduct?.sizes?.length === 0) {
            existingProduct.quantity += product.quantity;
            existingProduct.outOfStock = false;
        }

        // Retail + Variable product
        if (data.orderType === 'retail' && existingProduct.sizes.length > 0) {
            existingProduct.sizes.filter(size => size.size === product.size)[0].quantity += product.quantity;

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));

            existingProduct.outOfStock = false;
        }

        // Retail + Simple product
        if (data.orderType === 'retail' && existingProduct?.sizes?.length === 0) {
            existingProduct.quantity += product.quantity;

            existingProduct.outOfStock = false;
        }

        // Add product to array to save later
        if (!alreadyInDoneProducts) savedProducts.push(existingProduct);
    }

    return savedProducts;
}

export const OrderController = {
    get: async ({ cursor, from, to, type, orderType, customer, company, paymentType, unpaid, number }) => {
        let query = {
            $and: [{ deleted: { $ne: true } }]
        };
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

        if (!orders || orders.length === 0) return { orders: [], prevCursor, nextCursor };

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

        return { orders, prevCursor, nextCursor };
    },
    getParams: () => {
        var data = {
            orderTypes,
            paymentTypes,
            documentTypes
        };

        return data;
    },
    getById: async (id) => {
        const order = await Order.findById(id).populate('products.product customer company');

        if (!order) return { status: 404, message: 'Продажбата не е намерена' };
        return { order, status: 200 };
    },
    post: async ({ data, userId }) => {
        const validation = await validateOrder(data);

        if (validation) return validation;

        // Add sender to company
        const company = await Company.findById(data.company);

        if (!company.senders) company.senders = [data.sender];

        if (!company.senders.includes(data.sender)) company.senders.push(data.sender);

        await company.save();

        // Add receiver to customer
        const customer = await Customer.findById(data.customer);

        if (!customer.receivers) company.receivers = [data.receiver];

        if (!customer.receivers.includes(data.receiver)) customer.receivers.push(data.receiver);

        await customer.save();

        data.user = userId;

        let { total, updatedProducts, message, status } = await removeProductsQuantities({ data });

        if (status) return { status, message };

        data.total = total;

        data.unpaid = (data.paidAmount || 0).toFixed(2) < total;

        var seq = await AutoIncrement.findOneAndUpdate({ name: data.type, company }, { $inc: { seq: 1 } }, { new: true }).select('seq');

        if (!seq) seq = await AutoIncrement.create({ name: data.type, company, seq: 1 });

        data.number = seq.seq;

        const order = await new Order(data).save();

        return { status: 201, order, updatedProducts };
    },
    put: async ({ id, data, userId }) => {
        const validation = await validateOrder(data);

        if (validation) return validation;

        const order = await Order.findById(id);
        if (!order) return { status: 404, message: 'Документът не е намерен' };

        // Check if sender and receiver were changed
        if (data.sender !== order.sender) {
            const company = await Company.findById(data.company);

            if (!company) return { status: 404, message: 'Компанията не е намерена' };

            if (!company.senders) company.senders = [data.sender];

            if (!company.senders.includes(data.sender)) company.senders.push(data.sender);
            await company.save();
        }

        if (data.receiver !== order.receiver) {
            const customer = await Customer.findById(data.customer);

            if (!customer) return { status: 404, message: 'Партньорът не е намерен' };

            if (!customer.receivers) customer.receivers = [data.receiver];

            if (!customer.receivers.includes(data.receiver)) customer.receivers.push(data.receiver);

            await customer.save();
        }

        data.user = userId;

        // First return all initial order products quantity to stock without saving them to DB
        let returnedProducts = await returnProductsQuantities(order);

        // Then remove quantities of new products from stock, save is done here since the returnedProducts array is used to check the quantities before saving them
        let { total, updatedProducts, status, message } = await removeProductsQuantities({ data, returnedProducts });
        if (status) return { status, message };

        data.total = total;

        data.unpaid = (data.paidAmount || 0).toFixed(2) < total;

        // Check if company or document type was changed and change document number
        if (data.company !== order.company.toString() || data.type !== order.type) {
            var seq = await AutoIncrement.findOneAndUpdate({ name: data.type, company: data.company }, { $inc: { seq: 1 } }, { new: true }).select('seq');

            if (!seq)
                seq = await AutoIncrement.create({ name: data.type, company: data.company, seq: 1 });

            data.number = seq.seq;
        }

        await Order.findByIdAndUpdate(id, data);

        return { status: 201, updatedProducts };
    },
    delete: async (id) => {
        const order = await Order.findById(id);

        if (!order) return { status: 404, message: 'Документът не е намерен' };

        const returnedProducts = await returnProductsQuantities(order);

        order.deleted = true;
        await order.save();

        return { status: 204, returnedProducts };
    }
}