import axios from "axios";
import { escapeRegex } from "../functions/regex.js";
import { Customer } from "../models/customer.js";
import { Order } from "../models/order.js";

function validateCustomer(data) {
    const { name, vat, discount } = data;
    if (!name) return { status: 400, message: 'Въведете име', property: 'name' };

    if (vat && (vat.length < 9 || vat.length > 15)) return { status: 400, message: 'Невалиден ЕИК', property: 'vat' };

    // if discount entered, check if format is X or X.Y (ex. 1 or 1.5 or 1.55)
    if (discount && (discount < 0 || discount > 100 || discount.toString().match(/^(\d)+(\.\d{0,2}){0,1}$/) === null))
        return { status: 400, message: 'Невалидна отстъпка', property: 'discount' };
}

export const CustomerController = {

    checkVAT: async ({ countryCode, vatNumber }) => {
        // Call external VAT checking service
        try {
            const response = await axios.post('https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
                countryCode,
                vatNumber
            });

            return response.data;
        } catch (error) {
            console.error(error);
            return { status: 500, message: 'Възникна грешка при проверката на ЕИК' };
        }
    },
    get: async ({ search, pageSize, pageNumber, showDeleted, page }) => {
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

        // Either run search or normal pagination, tried but cant get both to work together
        if (search) { // search in vat or name
            const escapedSearch = escapeRegex(search);
            query.$or = [{ vat: { $regex: escapedSearch, $options: 'i' } }, { name: { $regex: escapedSearch, $options: 'i' } }, { phone: { $regex: escapedSearch, $options: 'i' }, }, { address: { $regex: escapedSearch, $options: 'i' }, }];
        }

        if (!showDeleted) query.deleted = { $ne: true };

        const customers = await Customer.find(query).limit(pageSize).skip(pageSize * (pageNumber - 1)).select('name vat phone address discount deleted');
        const count = await Customer.countDocuments(query);
        const pageCount = Math.ceil(count / pageSize);

        if (!customers || customers.length === 0) return { status: 200, customers: [], pageCount, count };

        return { status: 200, customers, pageCount, count };
    },
    findById: async (id) => {
        const customer = await Customer.findById(id);
        if (!customer) return { status: 404, message: 'Потребителят не е намерен' };

        return { customer, status: 200 };
    },
    post: async (data) => {
        const validation = validateCustomer(data);

        if (validation) return validation;

        if (data.vat) {
            const existingVat = await Customer.findOne({ vat: data.vat });
            if (existingVat) return { status: 400, message: 'Клиент с този ЕИК вече съществува', property: 'vat' };
        }

        if (data.taxvat) {
            const existingTaxVat = data.taxvat ? await Customer.findOne({ taxvat: data.taxvat }) : null;
            if (existingTaxVat) return { status: 400, message: 'Клиент с този ДДС ЕИК вече съществува', property: 'taxvat' };
        }

        // Add MOL to receivers so it autofills of first order
        data.receivers = [data.mol || data.name];

        // delete empty keys
        Object.keys(data).forEach((key) => {
            if (!data[key] || data.key === "") delete data[key];
        });

        const customer = await new Customer(data).save();

        return { status: 201, customer };
    },
    put: async (id, data) => {
        const validation = validateCustomer(data);

        if (validation) return validation;

        if (data.vat) {
            const existingVat = await Customer.findOne({ vat: data.vat });
            if (existingVat && existingVat._id.toString() !== id)
                return { status: 400, message: 'Клиент с този ЕИК вече съществува', property: 'vat' };
        }

        if (data.taxvat) {
            const existingTaxVat = data.taxvat ? await Customer.findOne({ taxvat: data.taxvat }) : null;
            if (existingTaxVat && existingTaxVat._id.toString() !== id)
                return { status: 400, message: 'Клиент с този ДДС ЕИК вече съществува', property: 'taxvat' };
        }

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