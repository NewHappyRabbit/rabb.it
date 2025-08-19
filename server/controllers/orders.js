import { Order, documentTypes, paymentTypes, orderTypes, woocommerce, } from "../models/order.js";
import { Customer } from "../models/customer.js";
import { Product } from "../models/product.js";
import { Company } from "../models/company.js";
import { AutoIncrement } from "../models/autoincrement.js";

async function validateOrder(data) {
    if (!data.date)
        return { status: 400, message: 'Въведете дата', property: 'date' };

    if (!data.type || Object.keys(documentTypes).indexOf(data.type) === -1)
        return { status: 400, message: 'Невалиден тип на документа', property: 'type' };

    if (!data.customer)
        return { status: 400, message: 'Въведете клиент', property: 'customer' };

    const existingCustomer = await Customer.findById(data.customer);

    if (!existingCustomer)
        return { status: 404, message: 'Клиентът не съществува', property: 'customer' };

    if (!data.orderType || Object.keys(orderTypes).indexOf(data.orderType) === -1)
        return { status: 400, message: 'Въведете тип на продажбата', property: 'orderType' };

    if (!data.paymentType || Object.keys(paymentTypes).indexOf(data.paymentType) === -1)
        return { status: 400, message: 'Невалиден тип на плащане', property: 'paymentType' };

    if (data.paidAmount < 0)
        return { status: 400, message: 'Платената сума трябва да е по-голяма или равна на 0', property: 'paidAmount' };

    if (!data.company)
        return { status: 400, message: 'Въведете фирма', property: 'company' };

    const existingCompany = await Company.findById(data.company);

    if (!existingCompany)
        return { status: 400, message: 'Фирмата не съществува', property: 'company' };

    if (!data.receiver)
        return { status: 400, message: 'Въведете получател', property: 'receiver' };

    if (!data.sender)
        return { status: 400, message: 'Въведете изпращач', property: 'sender' };

    if (!data.products || data.products.length === 0)
        return { status: 400, message: 'Въведете продукти', property: 'products' };

    for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];

        const existingProduct = await Product.findById(product.product);

        if (product.product && !existingProduct)
            return { status: 404, message: 'Продуктът не съществува', property: 'product' };

        if (!product.product && !product.name)
            return { status: 400, message: 'Въведете продукт', property: 'product', ...(existingProduct ? { _id: existingProduct._id } : {}) };

        // Variable existing product
        if (data.orderType === 'wholesale' && existingProduct && existingProduct.sizes.length > 0 && (!product.selectedSizes || product.selectedSizes?.length === 0))
            return { status: 400, message: `Трябва да изберете поне 1 размер за продукта: ${existingProduct.name} [${existingProduct.code}]`, property: 'size', _id: existingProduct._id };

        if (!product.quantity || product.quantity <= 0)
            return { status: 400, message: `Въведете количество за продукта: ${product.name}`, property: 'quantity', ...(existingProduct ? { _id: existingProduct._id } : {}) };

        if (!product.price)
            return { status: 400, message: 'Въведете цена', property: 'price', ...(existingProduct ? { _id: existingProduct._id } : {}) };

        if (product.price < 0)
            return { status: 400, message: 'Цената трябва да е по-голяма или равна на 0', property: 'price', ...(existingProduct ? { _id: existingProduct._id } : {}) };

        if (product.discount && (isNaN(product.discount) || product.discount < 0 || product.discount > 100))
            return { status: 400, message: 'Отстъпката трябва да е в границите между 0 и 100', property: 'discount', ...(existingProduct ? { _id: existingProduct._id } : {}) };

        if (!product.unitOfMeasure)
            return { status: 400, message: 'Липсва мярка за артикул', property: 'unitOfMeasure', ...(existingProduct ? { _id: existingProduct._id } : {}) };
    }
}

function pad(toPad, padChar, length) {
    return (String(toPad).length < length)
        ? new Array(length - String(toPad).length + 1).join(padChar) + String(toPad)
        : toPad;
}

async function removeProductsQuantities({ data, returnedProducts }) {
    var total = 0;
    var updatedProducts = returnedProducts || []; // If PUT, get returnedProducts quantities and save them here at the end if all is good
    // Calculate total and remove quantity from stock
    for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];

        if (!product.product) {
            total += (product.quantity * product.price) * (1 - product.discount / 100);
            continue;
        }

        // Check if in doneProducts first, otherwise search db
        const alreadyInDoneProducts = updatedProducts.find(p => p._id.toString() === product.product.toString());

        let productInDb = null;
        if (!alreadyInDoneProducts) productInDb = await Product.findById(product.product);
        const existingProduct = alreadyInDoneProducts || productInDb;

        // Wholesale + Variable product
        if (data.orderType === 'wholesale' && existingProduct.sizes.length > 0) {
            // Remove quantity from each selected size (can be all of them, or just some (sell open package))
            for (let size of product.selectedSizes) {
                const quantityToRemove = product.quantity * product.multiplier;
                // Check if there is enough quantity of selected size
                if (existingProduct.sizes.find(s => s.size === size).quantity < quantityToRemove)
                    return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} (${size}) [${existingProduct.code}]! Количество на склад: ${productInDb.sizes.find(s => s.size === size).quantity}` };

                existingProduct.sizes.find(s => s.size === size).quantity -= quantityToRemove;
            }

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = parseInt(Math.min(...existingProduct.sizes.map(s => s.quantity)) / existingProduct.multiplier);

            // If no quantity of any size is left, mark as out of stock
            if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                existingProduct.outOfStock = true;

            existingProduct.openedPackages = existingProduct.sizes.some(s => s.quantity !== existingProduct.sizes[0].quantity);
        }

        // Wholesale + Simple product
        if (data.orderType === 'wholesale' && existingProduct?.sizes?.length === 0) {
            // Check if there is enough quantity

            if (existingProduct.quantity < product.quantity)
                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]! Количество на склад: ${productInDb.quantity}` };

            existingProduct.quantity -= Number(product.quantity);

            // If no quantity left, mark as out of stock
            if (existingProduct.quantity <= 0) existingProduct.outOfStock = true;
        }

        // Retail + Variable product
        if (data.orderType === 'retail' && existingProduct.sizes?.length > 0) {
            // Check if there is enough quantity
            if (existingProduct.sizes.find(size => size.size === product.size).quantity < product.quantity)
                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} с размер ${product.size} [${existingProduct.code}]! Количество на склад: ${productInDb.sizes.find(size => size.size === product.size).quantity}` };

            existingProduct.sizes.find(size => size.size === product.size).quantity -= product.quantity;

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = parseInt(Math.min(...existingProduct.sizes.map(s => s.quantity)) / existingProduct.multiplier);

            // If no quantity of any size is left, mark as out of stock
            if (existingProduct.sizes.filter(size => size.quantity > 0).length === 0)
                existingProduct.outOfStock = true;
        }

        // Retail + Simple product
        if (data.orderType === 'retail' && existingProduct.sizes?.length === 0) {
            // Check if there is enough quantity
            if (existingProduct.quantity < product.quantity)
                return { status: 400, message: `Няма достатъчно количество от продукта: ${existingProduct.name} [${existingProduct.code}]! Количество на склад: ${productInDb.quantity}` };

            existingProduct.quantity -= Number(product.quantity);

            // If no quantity left, mark as out of stock
            if (existingProduct.quantity <= 0) existingProduct.outOfStock = true;
        }

        // Add product to array to save later
        if (!alreadyInDoneProducts) updatedProducts.push(existingProduct);

        total += (product.quantity * product.price) * (1 - product.discount / 100);
    }

    total = total.toFixed(2);

    return { total, updatedProducts };
}
async function returnProductsQuantities({ data, returnedProducts }) {
    var total = 0;
    var updatedProducts = returnedProducts || [];

    for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];

        if (!product.product) {
            total += (product.quantity * product.price) * (1 - product.discount / 100);
            continue;
        }

        // Check if in doneProducts first, otherwise search db
        const alreadyInDoneProducts = updatedProducts.find(p => p._id.toString() === product.product.toString());

        let productInDb = null;
        if (!alreadyInDoneProducts) productInDb = await Product.findById(product.product);
        const existingProduct = alreadyInDoneProducts || productInDb;

        // Wholesale + Variable product
        if (data.orderType === 'wholesale' && existingProduct.sizes.length > 0) {
            // Return quantity to each selected size (can be all of them, or just some (sell open package))

            let sizesToReturn;
            const quantityToReturn = product.quantity * (product.multiplier || 1);

            // If in original order the product was simple (had no sizes selected)
            if (product.selectedSizes.length === 0) {
                sizesToReturn = productInDb.sizes.map(s => s.size); // return quantity to all currently existing sizes
            } else sizesToReturn = product.selectedSizes; // else the previously selected sizes

            for (let size of sizesToReturn) {
                const s = existingProduct.sizes.find(s => s.size === size);
                // Check if size exists in product (it may have been removed for example)
                if (s) s.quantity += quantityToReturn;
            }

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = parseInt(Math.min(...existingProduct.sizes.map(s => s.quantity)) / existingProduct.multiplier);

            existingProduct.outOfStock = false;

            existingProduct.openedPackages = existingProduct.sizes.some(s => s.quantity !== existingProduct.sizes[0].quantity);
        }

        // Wholesale + Simple product
        if (data.orderType === 'wholesale' && existingProduct?.sizes?.length === 0) {
            existingProduct.quantity += Number(product.quantity);
            existingProduct.outOfStock = false;
        }

        // Retail + Variable product
        if (data.orderType === 'retail' && existingProduct.sizes.length > 0) {
            existingProduct.sizes.filter(size => size.size === product.size)[0].quantity += product.quantity;

            // Update package quantity to be the lowest of all selected sizes quantity
            existingProduct.quantity = parseInt(Math.min(...existingProduct.sizes.map(s => s.quantity)) / existingProduct.multiplier);

            existingProduct.outOfStock = false;
        }

        // Retail + Simple product
        if (data.orderType === 'retail' && existingProduct?.sizes?.length === 0) {
            existingProduct.quantity += Number(product.quantity);

            existingProduct.outOfStock = false;
        }

        // Add product to array to save later
        if (!alreadyInDoneProducts) updatedProducts.push(existingProduct);
        total += (product.quantity * product.price) * (1 - product.discount / 100);
    }
    total = total.toFixed(2);

    return { total, updatedProducts };
}

function combineProductRows(products) {
    const combinedProducts = products.reduce((acc, product) => {
        const existingProduct = acc.find(p => p.product?.toString() === product?.product?.toString() && p.price === product.price && p.discount === product.discount);
        if (existingProduct) existingProduct.quantity += product.quantity;
        else acc.push(product);
        return acc;
    }, []);

    return combinedProducts;
}

export const OrderController = {
    get: async ({ sort, pageNumber, pageSize, from, to, type, orderType, customer, company, paymentType, unpaid, number, deleted }) => {
        let query = {
            $and: []
        };

        number && query.$and.push({ number });

        from && query.$and.push({ date: { $gte: from } });

        to && query.$and.push({ date: { $lte: to } });

        type && query.$and.push({ type });

        orderType && query.$and.push({ orderType });

        paymentType && query.$and.push({ paymentType });

        unpaid && query.$and.push({ unpaid: true });

        deleted ? query.$and.push({ deleted: true }) : query.$and.push({ deleted: { $ne: true } });

        customer && query.$and.push({ 'customer': customer });

        company && query.$and.push({ 'company': company });

        if (typeof sort === 'string')
            sort = JSON.parse(sort);

        const orders = await Order.find(query).sort(sort).limit(pageSize).skip(pageSize * (pageNumber - 1)).select('-products -receiver -sender').populate('customer company');
        const count = await Order.countDocuments(query);
        const pageCount = Math.ceil(count / pageSize);

        if (!orders || orders.length === 0) return { count, pageCount, orders: [] };

        return { count, pageCount, orders };
    },
    getParams: () => {
        var data = {
            orderTypes,
            paymentTypes,
            documentTypes,
            woocommerce
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

        // Combine rows of products with the same product.id, price and discount
        data.products = combineProductRows(data.products);

        let { total, updatedProducts, message, status } = data.type !== 'credit' ? await removeProductsQuantities({ data }) : await returnProductsQuantities({ data }); // If credit, return quantity instead of removing it
        if (status) return { status, message };

        data.total = total;

        data.unpaid = parseFloat((data.paidAmount || 0).toFixed(2)) < parseFloat(total);

        data.paidHistory = [{ date: new Date(), amount: data.paidAmount || 0 }];

        if (!data.number) { // If no number assigned, grab latest from sequence
            let seq = await AutoIncrement.findOne({ name: data.type === 'credit' ? 'invoice' : data.type, company: company._id });
            if (seq)
                data.number = pad(Number(seq.seq) + 1, 0, 10);
            else if (!seq) {
                await AutoIncrement.create({ name: data.type, company: company, seq: 1 });
                data.number = pad(1, 0, 10);
            }
        }

        // Check if document number already exists
        const numberExists = await Order.findOne({ company: company._id, type: ['credit', 'invoice'].includes(data.type) ? { $in: ['invoice', 'credit'] } : data.type, number: data.number, deleted: false });
        if (numberExists && !data.woocommerce) return { status: 409, message: 'Документ с такъв номер вече съществува' }; // if creating order normally
        else if (numberExists && data.woocommerce) {
            // if creating order from woocommerce hook, Find latest document number and increment by 1
            const latestOrderNumber = await Order.findOne({ company: company._id, type: ['credit', 'invoice'].includes(data.type) ? { $in: ['invoice', 'credit'] } : data.type, deleted: false }).sort({ number: -1 });
            data.number = pad(Number(latestOrderNumber.number) + 1, 0, 10);
        }

        let seq = await AutoIncrement.findOne({ name: data.type === 'credit' ? 'invoice' : data.type, company: company._id });
        if (seq) {
            await AutoIncrement.findOneAndUpdate({ name: data.type === 'credit' ? 'invoice' : data.type, company }, { seq: Number(data.number) }, { new: true }).select('seq');
        } else if (!seq) {
            seq = await AutoIncrement.create({ name: data.type === 'credit' ? 'invoice' : data.type, company, seq: Number(data.number) || 1 });
            data.number = pad(seq.seq, 0, 10);
        }

        const order = await new Order(data).save();

        // Update all products in paralel with promies
        if (data.type !== 'credit' || (data.type === 'credit' && data.returnQuantity === true))
            await Promise.all(updatedProducts.map(async (product) => await product.save()));

        return { status: 201, order, updatedProducts };
    },
    put: async ({ id, data, userId }) => {
        const validation = await validateOrder(data);

        if (validation) return validation;

        const order = await Order.findById(id);
        if (!order) return { status: 404, message: 'Документът не е намерен' };

        // Check if sender and receiver were changed
        const company = await Company.findById(data.company);
        if (data.sender !== order.sender) {
            if (!company.senders) company.senders = [data.sender];

            if (!company.senders.includes(data.sender)) company.senders.push(data.sender);
            await company.save();
        }

        if (data.receiver !== order.receiver) {
            const customer = await Customer.findById(data.customer);

            if (!customer.receivers) customer.receivers = [data.receiver];

            if (!customer.receivers.includes(data.receiver)) customer.receivers.push(data.receiver);

            await customer.save();
        }

        data.user = userId;

        // Combine rows of products with the same product.id, price and discount
        data.products = combineProductRows(data.products);

        // First return all initial order products quantity to stock without saving them to DB
        let { updatedProducts: returnedProducts } = data.type !== 'credit' ? await returnProductsQuantities({ data: order }) : await removeProductsQuantities({ data: order });
        // Then remove quantities of new products from stock, save is done here since the returnedProducts array is used to check the quantities before saving them
        let { total, updatedProducts, message, status } = data.type !== 'credit' ? await removeProductsQuantities({ data, returnedProducts }) : await returnProductsQuantities({ data, returnedProducts }); // If credit, return quantity instead of removing it

        if (status) return { status, message };

        data.total = total;

        data.unpaid = parseFloat((data.paidAmount || 0).toFixed(2)) < parseFloat(total);

        if (data.paidAmount !== order.paidAmount || !order.paidHistory || order.paidHistory.length === 0) {
            // For old orders, before paidHistory was added
            if (!order.paidHistory) order.paidHistory = [];

            data.paidHistory = order.paidHistory;
            data.paidHistory.push({ date: new Date(), amount: data.paidAmount });
        }

        // New logic for editing document number
        // Check if document number already exists
        if (data.number) {
            const order = await Order.findOne({ company: company._id, type: ['credit', 'invoice'].includes(data.type) ? { $in: ['invoice', 'credit'] } : data.type, number: data.number, deleted: false });

            if (order && order._id.toString() !== id) return { status: 409, message: 'Документ с такъв номер вече съществува' };
        }

        // Only if number changed
        if (data.number !== order.number) {
            // Update sequence number if document number > current sequence number
            // Else, probably customer skipped a document number before and now fills the empty numbers
            let seq = await AutoIncrement.findOne({ name: data.type === 'credit' ? 'invoice' : data.type, company: company._id });
            if (seq) {
                await AutoIncrement.findOneAndUpdate({ name: data.type === 'credit' ? 'invoice' : data.type, company }, { seq: Number(data.number) }, { new: true }).select('seq');
            } else if (!seq) {
                seq = await AutoIncrement.create({ name: data.type === 'credit' ? 'invoice' : data.type, company, seq: Number(data.number) || 1 });
                data.number = pad(seq.seq, 0, 10);
            }
        }

        if (order.woocommerce && data.woocommerce) {
            // Update woo status
            const newStatus = data.woocommerce;
            data.woocommerce = order.woocommerce;
            data.woocommerce.status = newStatus.status;
        }

        await Order.findByIdAndUpdate(id, data);

        // Update all products in paralel with promies
        if (data.type !== 'credit' || (data.type === 'credit' && data.returnQuantity === true))
            await Promise.all(updatedProducts.map(async (product) => await product.save()));

        return { status: 201, updatedProducts };
    },
    markPaid: async ({ id, userId }) => {
        const order = await Order.findById(id);
        if (!order) return { status: 404, message: 'Документът не е намерен' };

        order.paidAmount = order.total;
        order.paidHistory.push({ date: new Date(), amount: order.paidAmount });
        order.unpaid = false;
        order.user = userId;

        await order.save();

        return { status: 201 };
    },
    delete: async (id, returnQuantity) => {
        const order = await Order.findById(id);

        if (!order) return { status: 404, message: 'Документът не е намерен' };

        const { updatedProducts } = order.type !== 'credit' ? await returnProductsQuantities({ data: order }) : await removeProductsQuantities({ data: order });

        // Update all products in paralel with promies
        if (returnQuantity === true)
            await Promise.all(updatedProducts.map(async (product) => await product.save()));

        order.deleted = true;
        await order.save();

        return { status: 204, updatedProducts };
    },
    restore: async (id, returnQuantity) => {
        const order = await Order.findById(id);

        if (!order) return { status: 404, message: 'Документът не е намерен' };

        const { updatedProducts, status, message } = order.type === 'credit' ? await returnProductsQuantities({ data: order }) : await removeProductsQuantities({ data: order });

        if (status) return { status, message };

        // Update all products in paralel with promies
        if (returnQuantity === true)
            await Promise.all(updatedProducts.map(async (product) => await product.save()));

        order.deleted = false;
        await order.save();

        return { status: 204, updatedProducts };
    }
}