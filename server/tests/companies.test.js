import { afterAll, describe, expect, test } from 'vitest'
import { CompanyController } from '../controllers/companies.js'
import { Company } from '../models/company.js';
import { mongoConfig } from '../config/database.js'
import { setEnvVariables } from './common.js';
import 'dotenv/config';
import { Order } from '../models/order.js';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await Company.deleteMany({});
    await Order.deleteMany({});
});

describe('POST /companies', async () => {
    describe('Create company', async () => {
        const data = {
            name: 'Фирма',
            bank: {
                name: 'Банка',
                code: 'BGASD',
                iban: 'BG23FSFSF12312312',
            },
            mol: 'Иван Иванов',
            phone: '0891231233',
            vat: '000000000',
            taxvat: 'BG000000000',
            address: 'гр. София ул. Димов №3',
        };

        const { status, company } = await CompanyController.post(data);
        test('Status is 201', () => {
            expect(status).toBe(201);
        });

        test('Name is correct', () => {
            expect(company.name).toEqual(data.name);
        });

        test('Bank is correct', () => {
            expect(company.bank.name).toEqual(data.bank.name);
            expect(company.bank.code).toEqual(data.bank.code);
            expect(company.bank.iban).toEqual(data.bank.iban);
        });

        test('MOL is correct', () => {
            expect(company.mol).toEqual(data.mol);
        });

        test('Phone is correct', () => {
            expect(company.phone).toEqual(data.phone);
        });

        test('VAT is correct', () => {
            expect(company.vat).toEqual(data.vat);
        });

        test('TaxVAT is correct', () => {
            expect(company.taxvat).toEqual(data.taxvat);
        });

        test('Address is correct', () => {
            expect(company.address).toEqual(data.address);
        });

        test('Sender is MOL', () => {
            expect(company.senders[0]).toContain(data.mol);
        });

        test('Tax is 20%', () => {
            expect(company.tax).toEqual(20);
        });

        test('Default is true', () => {
            // If no company exists, mark first as default
            expect(company.default).toBe(true);
        });
    });

    describe('Create company 2', async () => {
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

        const { status, company } = await CompanyController.post(data);
        test('Status is 201', () => {
            expect(status).toBe(201);
        });


        test('Default is false', () => {
            expect(company.default).toBe(false);
        });
    });

    describe('Validation', () => {

        test('No name', async () => {
            const { status, property } = await CompanyController.post({ x: 'x' });
            expect(status).toBe(400);
            expect(property).toBe('name');
        });

        test('No bank', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test' });
            expect(status).toBe(400);
            expect(property).toBe('bank');
        });

        test('No mol', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test', bank: { name: 'asd', code: 'asd', iban: 'asd' } });
            expect(status).toBe(400);
            expect(property).toBe('mol');
        });

        test('No address', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test', bank: { name: 'asd', code: 'asd', iban: 'asd' }, mol: 'asd' });
            expect(status).toBe(400);
            expect(property).toBe('address');
        })

        test('No vat', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test', bank: { name: 'asd', code: 'asd', iban: 'asd' }, mol: 'asd', address: 'qwe' });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('Vat too short', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test', bank: { name: 'asd', code: 'asd', iban: 'asd' }, mol: 'asd', vat: '123', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('Vat too long', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test', bank: { name: 'asd', code: 'asd', iban: 'asd' }, mol: 'asd', vat: '1231231231', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('Vat not unique', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test', bank: { name: 'asd', code: 'asd', iban: 'asd' }, mol: 'asd', vat: '000000001', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('vat');
        });

        test('TAXVAT not unique', async () => {
            const { status, property } = await CompanyController.post({ name: 'Test', bank: { name: 'asd', code: 'asd', iban: 'asd' }, mol: 'asd', vat: '000000005', taxvat: 'BG000000001', address: 'qwe', });
            expect(status).toBe(400);
            expect(property).toBe('taxvat');
        });
    })
});

/* describe('GET /companies', async () => {
    //TODO Test queries, pages, etc
}); */

describe('GET /companies/:id', async () => {
    test('Company exists', async () => {
        const companyDB = await Company.findOne({});
        const { status, company } = await CompanyController.getById(companyDB._id.toString());
        expect(status).toBe(200);
        expect(company.name).toBe(companyDB.name);
    });

    test('Company does not exist', async () => {
        const { status } = await CompanyController.getById('62bcb4db3f7991ea4fc6830e');
        expect(status).toBe(404);
    });
});

describe('PUT /companies/:id', async () => {
    const companyDB = await Company.findOne({});
    companyDB.name = 'Asd';
    companyDB.bank = { name: 'asd', code: 'qwe', iban: 'zxc' };
    companyDB.mol = 'asd';
    companyDB.phone = '123';
    companyDB.vat = '123456777';
    companyDB.taxvat = 'BG123456777';
    companyDB.address = 'asd';

    const { status } = await CompanyController.put(companyDB._id.toString(), companyDB);
    const company = await Company.findById(companyDB._id);

    test('Name', async () => {
        expect(status).toBe(201);
        expect(company.name).toBe('Asd');
    });

    test('Bank', async () => {
        expect(status).toBe(201);
        expect(company.bank.name).toBe('asd');
        expect(company.bank.code).toBe('qwe');
        expect(company.bank.iban).toBe('zxc');
    });

    test('MOL', async () => {
        expect(status).toBe(201);
        expect(company.mol).toBe('asd');
    });

    test('Phone update', async () => {
        expect(status).toBe(201);
        expect(company.phone).toBe('123');
    });

    test('VAT', async () => {
        expect(status).toBe(201);
        expect(company.vat).toBe('123456777');
    });

    test('TAXVAT update', async () => {
        expect(status).toBe(201);
        expect(company.taxvat).toBe('BG123456777');
    });

    test('Address', async () => {
        expect(status).toBe(201);
        expect(company.address).toBe('asd');
    });

    test('New MOL added to senders', async () => {
        expect(status).toBe(201);
        expect(company.senders).toHaveLength(2);
        expect(company.senders).toContain('asd');
    });

    companyDB.phone = null;
    companyDB.taxvat = null;

    const { status: status2 } = await CompanyController.put(companyDB._id.toString(), companyDB);
    const company2 = await Company.findById(companyDB._id);

    test('Phone remove', async () => {
        expect(status2).toBe(201);
        expect(company2.phone).toBeNull();
    });

    test('TAXVAT remove', async () => {
        expect(status2).toBe(201);
        expect(company2.taxvat).toBeNull();
    });
});

describe('DELETE /companies/:id', async () => {
    const companyDB = await Company.findOne({});

    async function setDefaultCompany() {
        // This is the 'PUT /companies/:id/setDefault' test
        // Its placed here because the DELETE block doesnt wait for it and breaks it
        const current = await Company.findOne({ default: true });
        const another = await Company.findOne({ default: false });

        const { status } = await CompanyController.setDefault(another._id);
        expect(status).toBe(201);

        const newDefault = await Company.findById(another._id);
        expect(newDefault.default).toBe(true);

        const oldDefault = await Company.findById(current._id);
        expect(oldDefault.default).toBe(false);
    }

    await setDefaultCompany();

    const { status } = await CompanyController.delete(companyDB._id.toString());
    const company = await Company.findById(companyDB._id);

    test('Delete', async () => {
        expect(status).toBe(204);
        expect(company).toBeNull();
    });

    test('New default company set', async () => {
        const companies = await Company.find({ default: true });
        expect(companies).toHaveLength(1);
    });

    test('Cant delete company with orders', async () => {
        const company2 = await Company.findOne({});
        // Create fake order
        new Order({
            _id: '62bcb4db3f7991ea4fc6830e', // fake id
            company: company2._id,
        }, { bypassDocumentValidation: true }).save(); // bypass the required fields in the model

        const { status: status2, property } = await CompanyController.delete(company2._id.toString());
        expect(status2).toBe(400);

        expect(property).toBe('orders');
    });
});

await Company.deleteMany({});
await Order.deleteMany({});