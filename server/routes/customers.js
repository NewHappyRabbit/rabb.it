import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Customer } from "../models/customer.js";
import { Order } from "../models/order.js";

function validateCustomer(data) {
    const { name, mol, vat, address, discount } = data;
    if (!name || !mol || !vat || !address || (vat && vat.length < 9 || vat.length > 10))
        return { status: 400, error: 'Липсват задължителните полета' };

    // if discount entered, check if format is X or X.Y (ex. 1 or 1.5 or 1.55)
    if (discount && discount >= 0 && discount.match(/^(\d)+(\.\d{0,2}){0,1}$/) === null)
        return { status: 400, error: 'Невалидна отстъпка' };
}

export function customersRoutes() {
    const customersRouter = express.Router();

    customersRouter.get('/customers', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            let query = {};

            const cursor = req.query.cursor;
            const search = req.query.search;
            const showDeleted = req.query.showDeleted;
            var prevCursor = null;
            var nextCursor = null;
            var limit = 15;

            // Either run search or normal pagination, tried but cant get both to work together
            if (search) { // search in vat or name
                query.$or = [{ vat: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
                limit = 0;
            } else if (!search && cursor)
                query._id = { $gte: cursor };

            if (!showDeleted)
                query.deleted = { $ne: true };

            const customers = await Customer.find(query).limit(limit).select('name vat phone discount deleted');

            if (!customers || customers.length === 0)
                return res.json({ customers: [], prevCursor, nextCursor });

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

            res.json({ customers, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.get('/customers/all', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            // This route is used for view orders page to get all customers
            const customers = await Customer.find({ deleted: { $ne: true } }).select('name vat phone');
            res.json(customers);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.get('/customers/forSales', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            // this route is used in create/edit orders page to get all customers
            const customers = await Customer.find({ deleted: { $ne: true } }).select('name vat discount receivers phone');
            res.json(customers);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.get('/customers/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const customer = await Customer.findById(req.params.id);
            if (!customer)
                return res.status(404).send('Customer not found');

            res.json(customer);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.post('/customers', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const data = { ...req.body };

            const validation = validateCustomer(data);

            if (validation)
                return res.status(validation.status).send(validation.error);

            const existingVat = await Customer.findOne({ vat: data.vat });
            if (existingVat)
                return res.status(400).send('Клиент с този ЕИК вече съществува');

            const existingTaxVat = data.taxvat ? await Customer.findOne({ taxvat: data.taxvat }) : null;
            if (existingTaxVat)
                return res.status(400).send('Клиент с този ДДС ЕИК вече съществува');

            // Add MOL to receivers so it autofills of first order
            data.receivers = [data.mol];

            const customer = await new Customer(data).save();

            res.status(201).send();
            req.log.info(customer, 'Customer created');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.put('/customers/:id', permit('manager', 'admin'), async (req, res) => {
        try {
            const data = { ...req.body };
            const validation = validateCustomer(data);

            if (validation) {
                return res.status(validation.status).send(validation.error);
            }

            const existingVat = await Customer.findOne({ vat: data.vat });
            if (existingVat && existingVat._id.toString() !== req.params.id)
                return res.status(400).send('Клиент с този ЕИК вече съществува');

            const existingTaxVat = data.taxvat ? await Customer.findOne({ taxvat: data.taxvat }) : null;
            if (existingTaxVat && existingTaxVat._id.toString() !== req.params.id)
                return res.status(400).send('Клиент с този ДДС ЕИК вече съществува');

            // Add new MOL to receivers array
            const customerOld = await Customer.findById(req.params.id);

            if (data.mol && !customerOld.receivers.includes(data.mol)) // if new mol add to receivers
                data.receivers = [...customerOld.receivers, data.mol];

            const customer = await Customer.updateOne({ _id: req.params.id }, data);

            res.status(201).send();
            req.log.info(customer, 'Customer updated');
        } catch (error) {
            console.log(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }

    });

    customersRouter.delete('/customers/:id', permit('admin'), async (req, res) => {
        try {
            const customer = await Customer.findById(req.params.id);
            if (!customer)
                return res.status(404).send('Customer not found');

            const hasDocuments = (await Order.find({ customer }).limit(1)).length > 0;

            if (hasDocuments)
                await customer.updateOne({ deleted: true });
            else
                await customer.deleteOne();

            res.status(204).send();
            res.log.info(customer, `Customer ${hasDocuments ? 'hidden' : 'deleted'}`);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.put('/customers/:id/unhide', permit('admin'), async (req, res) => {
        try {
            const customer = await Customer.findById(req.params.id);

            if (!customer)
                return res.status(404).send('Customer not found');

            customer.deleted = false;
            await customer.save();

            res.status(201).send();
            res.log.info(customer, 'Customer unhidden');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, customersRouter);
}