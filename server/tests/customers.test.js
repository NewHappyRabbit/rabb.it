import { afterAll, describe, expect, test } from 'vitest'
import { CustomerController } from '../controllers/customers.js'
import { Customer } from '../models/customer.js';
import { mongoConfig } from '../config/database.js'
import { setEnvVariables } from './common.js';
import 'dotenv/config';
import { Order } from '../models/order.js';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await Customer.deleteMany({});
    await Order.deleteMany({});
});

describe('POST /companies', async () => {
    describe('Create customer', async () => {
        const data = {
            name: 'Фирма',
            mol: 'Иван Иванов',
            phone: '0891231233',
            email: 'test@gmail.com',
            vat: '000000000',
            taxvat: 'BG000000000',
            address: 'гр. София ул. Димов №3',
            deliveryAddress: 'asd',
            discount: 30,
        };

        const { status, customer } = await CustomerController.post(data);
        test('Status is 201', () => {
            expect(status).toBe(201);
        });

        test('Name is correct', () => {
            expect(customer.name).toEqual(data.name);
        });

        test('MOL is correct', () => {
            expect(customer.mol).toEqual(data.mol);
        });

        test('Phone is correct', () => {
            expect(customer.phone).toEqual(data.phone);
        });

        test('Email is correct', () => {
            expect(customer.email).toEqual(data.email);
        });

        test('VAT is correct', () => {
            expect(customer.vat).toEqual(data.vat);
        });

        test('TaxVAT is correct', () => {
            expect(customer.taxvat).toEqual(data.taxvat);
        });

        test('Address is correct', () => {
            expect(customer.address).toEqual(data.address);
        });

        test('Delivery address is correct', () => {
            expect(customer.deliveryAddress).toEqual(data.deliveryAddress);
        });

        test('Discount is correct', () => {
            expect(customer.discount).toEqual(data.discount);
        });

        test('Receiver is MOL', () => {
            expect(customer.receivers[0]).toContain(data.mol);
        });
    });

    describe('Create customer 2', async () => {
        const data = {
            name: 'Фирма 2',
            bank: {
                name: 'Банка',
                code: 'BGASD',
                iban: 'BG23FSFSF12312312',
            },
            mol: 'Иван Иванов',
            phone: '0891231233',
            vat: '000000001',
            taxvat: 'BG000000001',
            address: 'гр. София ул. Димов №3',
        };

        const { status } = await CustomerController.post(data);
        test('Status is 201', () => {
            expect(status).toBe(201);
        });
        test('Default discount is 0', async () => {
            const customer = await Customer.findOne({ vat: '000000001' });
            expect(customer.discount).toBe(undefined);
        })
    });

    describe('Validation', () => {
        test('No name', async () => {
            const { status, property } = await CustomerController.post({ x: 'x' });
            expect(status).toBe(400);
            expect(property).toBe('name');
        });

        test('No mol', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', });
            expect(status).toBe(400);
            expect(property).toBe('mol');
        });

        test('No address', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd' });
            expect(status).toBe(400);
            expect(property).toBe('address');
        });

        test('No vat', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', address: 'qwe' });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('Vat too short', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', vat: '123', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('Vat too long', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', vat: '12345678901', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('Discount less than 0', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', vat: '000000005', address: 'qwe', discount: -5 });
            expect(status).toBe(400);
            expect(property).toBe('discount');
        });

        test('Discount more than 100', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', vat: '000000005', address: 'qwe', discount: 105 });
            expect(status).toBe(400);
            expect(property).toBe('discount');
        })

        test('Discount not X.XX or X.X or X', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', vat: '000000005', address: 'qwe', discount: 5.555 });
            expect(status).toBe(400);
            expect(property).toBe('discount');
        });

        test('Vat not unique', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', vat: '000000001', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('TAXVAT not unique', async () => {
            const { status, property } = await CustomerController.post({ name: 'Test', mol: 'asd', vat: '050500555', taxvat: 'BG000000001', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('taxvat');
        });
    })
});

describe('PUT /companies/:id', async () => {
    const customerData = {
        name: 'Фирма',
        mol: 'Иван Иванов',
        phone: '0891231233',
        email: 'test@gmail.com',
        vat: '505050506',
        taxvat: 'BG50505050506',
        address: 'гр. София ул. Димов №3',
        receivers: 'Иван Иванов',
        deliveryAddress: 'asd',
        discount: 30,
    };

    const customerData2 = {
        name: 'Фирма 2',
        mol: 'Иван Иванов',
        phone: '0891231233',
        email: 'test@gmail.com',
        vat: '888888888',
        taxvat: 'BG888888888',
        address: 'гр. София ул. Димов №3',
        receivers: 'Иван Иванов',
        deliveryAddress: 'asd',
        discount: 30,
    };

    const customer = await new Customer(customerData).save();
    const customer2 = await new Customer(customerData).save();


    describe('Update customer', async () => {
        const data = {
            name: 'Test',
            mol: 'Драган Петков',
            vat: '123321123',
            taxvat: 'BG123321123',
            address: 'qwe',
            deliveryAddress: 'asd',
            discount: 5,
            phone: '000',
            email: '000@abv.bg'
        };

        const { status } = await CustomerController.put(customer._id.toString(), data);

        expect(status).toBe(201);

        const updatedCustomer = await Customer.findOne({ vat: data.vat });

        test('Data is correct', () => {
            expect(updatedCustomer.name).toBe(data.name);
            expect(updatedCustomer.mol).toBe(data.mol);
            expect(updatedCustomer.vat).toBe(data.vat);
            expect(updatedCustomer.taxvat).toBe(data.taxvat);
            expect(updatedCustomer.address).toBe(data.address);
            expect(updatedCustomer.deliveryAddress).toBe(data.deliveryAddress);
            expect(updatedCustomer.discount).toBe(data.discount);
            expect(updatedCustomer.phone).toBe(data.phone);
            expect(updatedCustomer.email).toBe(data.email);
        });

        test('New mol added to receivers', async () => {
            expect(updatedCustomer.receivers).includes(data.mol);
        });
    });

    describe('Validate', async () => {
        test('Same vat', async () => {
            const data = {
                name: 'Test',
                mol: 'Драган Петков',
                vat: '123321123',
                taxvat: 'BG123321123',
                address: 'qwe',
                deliveryAddress: 'asd',
                discount: 5,
                phone: '000',
                email: '000@abv.bg'
            };

            const { status, property } = await CustomerController.put(customer2._id.toString(), data);
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('Same taxvat', async () => {
            const data = {
                name: 'Test',
                mol: 'Драган Петков',
                vat: '412344444',
                taxvat: 'BG123321123',
                address: 'qwe',
                deliveryAddress: 'asd',
                discount: 5,
                phone: '000',
                email: '000@abv.bg'
            };

            const { status, property } = await CustomerController.put(customer2._id.toString(), data);
            expect(status).toBe(400);
            expect(property).toBe('taxvat');
        })
    });
});


await Customer.deleteMany({});
await Order.deleteMany({});