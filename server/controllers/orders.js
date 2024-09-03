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

        if (product.product) {
            const existingProduct = await Product.findById(product.product);

            if (!existingProduct)
                return { status: 400, message: 'Продуктът не съществува' };
        }

        if (!product.product && !product.name)
            return { status: 400, message: 'Въведете продукт' };

        if (!product.quantity)
            return { status: 400, message: 'Въведете количество' };

        if (product.quantity < 1)
            return { status: 400, message: 'Количеството трябва да е по-голямо от 0' };

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
    OLDpost: async ({ data, userId }) => {
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

        var total = 0;
        var doneProducts = [];
        // Calculate total of products and remove quantity from stock
        for (let i = 0; i < data.products.length; i++) {
            const product = data.products[i];

            if (product.product) {
                const existingProduct = await Product.findById(product.product);

                if (data.orderType === 'wholesale') {
                    // check if there are enough quantity
                    if (existingProduct.quantity < product.quantity)
                        return { status: 400, message: `Няма достатъчно пакети от продукта: ${existingProduct.name} [${existingProduct.code}]` };

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
                        return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]` };

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

        const order = await new Order(data).save();

        return { status: 201, order, doneProducts };
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

        var total = 0;
        var doneProducts = [];

        // Calculate total and remove quantity from stock
        for (let i = 0; i < data.products.length; i++) {
            const product = data.products[i];

            if (product.product) {
                const existingProduct = await Product.findById(product.product);

                // Wholesale + Variable product
                if (data.orderType === 'wholesale' && existingProduct.sizes.length > 0) {
                    // Remove quantity from each selected size (can be all of them, or just some (sell open package))
                    for (let size of product.selectedSizes) {
                        // Check if there is enough quantity of selected size
                        if (existingProduct.sizes.filter(s => s.size === size)[0].quantity < product.quantity)
                            return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} (${size}) [${existingProduct.code}]` };

                        existingProduct.sizes.filter(s => s.size === size)[0].quantity -= product.quantity;
                    }

                    // Update package quantity to be the lowest of all selected sizes quantity
                    existingProduct.qtyInPackage = Math.min(...existingProduct.sizes.map(s => s.quantity));

                    // If no quantity of any size is left, mark as out of stock
                    if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                        existingProduct.outOfStock = true;
                }

                // Wholesale + Simple product
                if (data.orderType === 'wholesale' && existingProduct?.sizes?.length === 0) {
                    // Check if there is enough quantity

                    if (existingProduct.quantity < product.quantity)
                        return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]` };

                    existingProduct.quantity -= product.quantity;

                    // If no quantity left, mark as out of stock
                    if (existingProduct.quantity <= 0) existingProduct.outOfStock = true;
                }

                // Retail + Variable product
                if (data.orderType === 'retail' && existingProduct.sizes.length > 0) {
                    // Check if there is enough quantity
                    if (existingProduct.sizes.filter(size => size.size === product.size)[0].quantity < product.quantity)
                        return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} (${product.size}) [${existingProduct.code}]` };

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
                        return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]` };

                    existingProduct.quantity -= product.quantity;

                    // If no quantity left, mark as out of stock
                    if (existingProduct.quantity <= 0) existingProduct.outOfStock = true;
                }

                // Add product to array to save later
                doneProducts.push(existingProduct);
            }

            total += (product.quantity * product.price) * (1 - product.discount / 100);
        }

        // If all goes well, save all products
        doneProducts.forEach(async product => await product.save());
        data.total = total.toFixed(2);

        data.unpaid = (data.paidAmount || 0).toFixed(2) < total.toFixed(2);

        var seq = await AutoIncrement.findOneAndUpdate({ name: data.type, company }, { $inc: { seq: 1 } }, { new: true }).select('seq');

        if (!seq) seq = await AutoIncrement.create({ name: data.type, company, seq: 1 });

        data.number = seq.seq;

        const order = await new Order(data).save();

        return { status: 201, order, doneProducts };
    },
    put: async ({ id, data, userId }) => {
        //TODO Remake this function to be more simple
        // Instead of comparing old and new data, restore all previous data qty and save new data
        // Keep track of old & new products and update qty in woocommerce
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

        var total = 0;

        var doneProducts = [];
        // Calculate total of products and remove/add quantity to stock
        for (let i = 0; i < data.products.length; i++) {
            const product = data.products[i];

            if (product.product) { // If product in db
                const existingProduct = await Product.findById(product.product);
                const qtyDiff = product.quantity - (order.products.find(p => p.product == product.product)?.quantity || 0);

                //TODO Test both order edits and see if sizes are returned/removed correctly
                if (order.orderType === 'wholesale') {
                    // if qty was added
                    if (qtyDiff > 0) {
                        // check if there are enough quantity
                        if (existingProduct.quantity < qtyDiff) return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]` };

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
                    // check if newly added product or the size was changed
                    if (order.products.find(p => p.product == product.product) && product.size && product.size !== order.products.find(p => p.product == product.product).size) {
                        // check if there are enough quantity of size
                        const oldSize = order.products.find(p => p.product == product.product).size;
                        const oldQty = order.products.find(p => p.product == product.product).quantity;

                        const newSize = product.size;
                        const newQty = product.quantity;

                        if (existingProduct.sizes.filter(size => size.size === newSize)[0].quantity < newQty) return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]` };

                        // remove qty from newly selected size
                        existingProduct.sizes.filter(size => size.size === newSize)[0].quantity -= newQty;

                        // add to old size
                        existingProduct.sizes.filter(size => size.size === oldSize)[0].quantity += oldQty;

                        existingProduct.outOfStock = false;
                    } else {
                        if (qtyDiff > 0) {
                            if (product.size && existingProduct.sizes.filter(size => size.size === product.size)[0].quantity < qtyDiff) // check if there are enough quantity of size
                                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]` };
                            else if (existingProduct.sizes.length === 0 && existingProduct.quantity < qtyDiff) // check if there are enough quantity
                                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]` };

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

                }
                doneProducts.push(existingProduct);
            }

            total += (product.quantity * product.price) * (1 - product.discount / 100);
        }

        // if all goes well, save all products
        doneProducts.forEach(async product => await product.save());
        doneProducts = [];

        // Check if any products were completely removed
        for (let product of order.products) {
            // if product is in db
            if (product.product && !data.products.find(p => p.product == product.product)) {
                // Check if product already in doneProducts
                const found = doneProducts.find(p => p._id == product._id);

                const existingProduct = found || await Product.findById(product.product);
                if (order.orderType === 'wholesale') {
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
        }

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

        return { status: 201 };
    },
    delete: async (id) => {
        const order = await Order.findById(id);

        if (!order) return { status: 404, message: 'Документът не е намерен' };

        const doneProducts = [];
        // Return quantity to products
        order.products.forEach(async product => {
            if (order.orderType === 'wholesale' && product.product) {
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
                doneProducts.push(existingProduct);
            } else if (order.orderType === 'retail' && product.product) {
                const existingProduct = await Product.findById(product.product);

                if (existingProduct.sizes.length > 0) {
                    existingProduct.sizes.filter(size => size.size === product.size)[0].quantity += product.quantity; // to size

                    // set product quantity to lowest size value
                    existingProduct.quantity = Math.min(...existingProduct.sizes.map(s => s.quantity));
                } else
                    existingProduct.quantity += product.quantity; // to quantity


                existingProduct.outOfStock = false;
                doneProducts.push(existingProduct);
            }
        });

        // if all goes well, save all products
        doneProducts.forEach(async product => await product.save());

        order.deleted = true;
        await order.save();

        return { status: 204, doneProducts };
    }
}