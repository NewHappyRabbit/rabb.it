import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Company } from "../models/company.js";
import { Sale } from "../models/sale.js";


function validateCompany(data) {
    const { name, bank, mol, vat, address, tax } = data;
    if (!name || !bank || !mol || !vat || !address || (vat && vat.length !== 9))
        return { status: 400, error: 'Липсват задължителни полета' };

    if (tax < 0 || tax > 100)
        return { status: 400, error: 'Невалидна данъчна ставка' };

    if (!bank.name || !bank.code || !bank.iban || bank.iban.length > 34)
        return { status: 400, error: 'Невалидни банкови данни' };
}

export function companiesRoutes() {
    const companiesRouter = express.Router();

    companiesRouter.get('/companies', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const companies = await Company.find().sort({ default: -1 });

            res.json(companies);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.get('/companies/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const company = await Company.findById(req.params.id);
            if (!company)
                return res.status(404).send('Фирмата не е намерена');

            res.json(company);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.post('/companies', permit('admin'), async (req, res) => {
        try {
            const data = { ...req.body };

            const validation = validateCompany(data);

            if (validation)
                return res.status(validation.status).send(validation.error);

            // check if vat and taxvat are unique
            var existingCompany;
            if (data.taxvat)
                existingCompany = await Company.findOne({ $or: [{ vat: data.vat }, { taxvat: data.taxvat }] });
            else existingCompany = await Company.findOne({ vat: data.vat });

            if (existingCompany)
                return res.status(400).send('Фирма с този ЕИК/ДДС ЕИК вече съществува');

            // check if no companies exist and set as default
            const companies = await Company.find();
            if (companies.length === 0)
                data.default = true;

            // Add MOL to senders so it autofills on first sale
            data.senders = [data.mol];

            const company = await new Company(data).save();

            res.status(201).send();
            req.log.info(company, 'Company created');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.put('/companies/:id', permit('admin'), async (req, res) => {
        try {
            const data = { ...req.body };
            const validation = validateCompany(data);

            if (validation) {
                return res.status(validation.status).send(validation.error);
            }

            // check if vat and taxvat are unique
            var existingCompany;
            if (data.taxvat)
                existingCompany = await Company.findOne({ $or: [{ vat: data.vat }, { taxvat: data.taxvat }] });
            else existingCompany = await Company.findOne({ vat: data.vat });

            if (existingCompany && existingCompany._id.toString() != req.params.id)
                return res.status(400).send('Фирма с този ЕИК/ДДС ЕИК вече съществува');

            // Add new MOL to receivers array
            const companyOld = await Company.findById(req.params.id);

            if (data.mol && !companyOld.senders.includes(data.mol)) // if new mol add to receivers
                data.senders = [...companyOld.senders, data.mol];

            const company = await Company.updateOne({ _id: req.params.id }, data);

            res.status(201).send();
            req.log.info(company, 'Company updated');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }

    });

    companiesRouter.delete('/companies/:id', permit('admin'), async (req, res) => {
        try {
            const company = await Company.findById(req.params.id);
            if (!company)
                return res.status(404).send('Фирмата не е намерена');

            const hasDocuments = (await Sale.find({ company: company }).limit(1)).length > 0;

            if (hasDocuments)
                return res.status(400).send('Тази фирма има издадени документи и не може да бъде изтрита!');

            if (company.default === true) {
                // set another company as default
                const newDefaultCompany = await Company.findOne({ _id: { $ne: company._id } });
                if (newDefaultCompany) {
                    newDefaultCompany.default = true;
                    await newDefaultCompany.save();
                }
            }

            await company.deleteOne();

            res.status(204).send();
            res.log.info(company, 'Company deleted');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.put('/companies/:id/default', permit('admin'), async (req, res) => {
        try {
            const company = await Company.findById(req.params.id);
            if (!company)
                return res.status(404).send('Фирмата не е намерена');

            // Find and reset default company
            await Company.findOneAndUpdate({ default: true }, { default: false });

            company.default = true;

            await company.save();
            res.status(201).send();

            res.log.info(company, 'Company set as default');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, companiesRouter);
}