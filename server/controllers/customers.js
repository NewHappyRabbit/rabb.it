import { Customer } from "../models/customer.js";
import { Order } from "../models/order.js";

function validateCustomer(data) {
    const { name, mol, vat, address, discount } = data;
    if (!name || !mol || !vat || !address || (vat && vat.length < 9 || vat.length > 10))
        return { status: 400, message: 'Липсват задължителните полета' };

    // if discount entered, check if format is X or X.Y (ex. 1 or 1.5 or 1.55)
    if (discount && discount >= 0 && discount.match(/^(\d)+(\.\d{0,2}){0,1}$/) === null)
        return { status: 400, message: 'Невалидна отстъпка' };
}

export const CustomerController = {
    get: async ({ search, cursor, showDeleted, page }) => {
        // Page is used to prevent multiple urls from being created and instead using one single get request
        // If no page is given then it will return all customers
        if (page && (page === 'orders' || page === 'references')) {
            const customers = await Customer.find({ deleted: { $ne: true } }).select('name vat phone');
            return { customers, status: 200 };
        }

        if (page && page === 'createOrder') {
            const customers = await Customer.find({ deleted: { $ne: true } }).select('name vat discount receivers phone');
            return { customers, status: 200 };
        }

        let query = {}
        var prevCursor = null;
        var nextCursor = null;
        var limit = 15;

        // Either run search or normal pagination, tried but cant get both to work together
        if (search) { // search in vat or name
            query.$or = [{ vat: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
            limit = 0;
        } else if (!search && cursor) query._id = { $gte: cursor };

        if (!showDeleted) query.deleted = { $ne: true };

        const customers = await Customer.find(query).limit(limit).select('name vat phone discount deleted');

        if (!customers || customers.length === 0) return { customers: [], prevCursor, nextCursor };

        if (!search) {
            // get next customer to generate cursor for traversing
            const nextQuery = {
                _id: { $gt: customers[customers.length - 1]._id },
            }
            if (!showDeleted)
                nextQuery.deleted = { $ne: true };

            const nextCustomer = await Customer.find(nextQuery).limit(limit).select('_id').sort({ _id: 1 });
            nextCursor = (nextCustomer.length > 0) ? nextCustomer[0]._id : null;

            // get previous customers to generate cursor for traversing
            const prevQuery = {
                _id: { $lt: cursor },
            }

            if (!showDeleted)
                prevQuery.deleted = { $ne: true };

            const prevCustomers = await Customer.find(prevQuery).limit(limit).select('_id').sort({ _id: -1 });
            prevCursor = prevCustomers.length > 0 ? prevCustomers.slice(-1)[0]._id : null;
        }

        return { status: 200, customers, prevCursor, nextCursor };
    },
    getById: async (id) => {
        const customer = await Customer.findById(id);
        if (!customer) return { status: 404, message: 'Потребителят не е намерен' };

        return { customer, status: 200 };
    },
    post: async (data) => {
        const validation = validateCustomer(data);

        if (validation) return validation;

        const existingVat = await Customer.findOne({ vat: data.vat });
        if (existingVat) return { status: 400, message: 'Клиент с този ЕИК вече съществува' };

        const existingTaxVat = data.taxvat ? await Customer.findOne({ taxvat: data.taxvat }) : null;
        if (existingTaxVat) return { status: 400, message: 'Клиент с този ДДС ЕИК вече съществува' };

        // Add MOL to receivers so it autofills of first order
        data.receivers = [data.mol];

        const customer = await new Customer(data).save();

        return { status: 201, customer };
    },
    put: async (id, data) => {
        const validation = validateCustomer(data);

        if (validation) return validation;

        const existingVat = await Customer.findOne({ vat: data.vat });
        if (existingVat && existingVat._id.toString() !== id)
            return { status: 400, message: 'Клиент с този ЕИК вече съществува' };

        const existingTaxVat = data.taxvat ? await Customer.findOne({ taxvat: data.taxvat }) : null;
        if (existingTaxVat && existingTaxVat._id.toString() !== id)
            return { status: 400, message: 'Клиент с този ДДС ЕИК вече съществува' };

        // Add new MOL to receivers array
        const customerOld = await Customer.findById(id);

        if (data.mol && !customerOld.receivers.includes(data.mol)) // if new mol add to receivers
            data.receivers = [...customerOld.receivers, data.mol];

        await customerOld.updateOne(data);

        return { status: 201 };
    },
    delete: async (id) => {
        const customer = await Customer.findById(id);
        if (!customer) return { status: 404, message: 'Партньорът не е намерен' };

        const hasDocuments = (await Order.find({ customer }).limit(1)).length > 0;

        if (hasDocuments) await customer.updateOne({ deleted: true });
        else await customer.deleteOne();

        return { status: 204 };
    },
    unhide: async (id) => {
        const customer = await Customer.findById(id);

        if (!customer) return { status: 404, message: 'Партньорът не е намерен' };

        customer.deleted = false;
        await customer.save();

        return { status: 201 };
    }


}