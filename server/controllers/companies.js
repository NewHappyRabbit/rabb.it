import { Company } from "../models/company.js";
import { Order } from "../models/order.js";

function validateCompany(data) {
    const { name, bank, mol, vat, address, tax } = data;
    if (!name || !bank || !mol || !vat || !address || (vat && vat.length !== 9))
        return { status: 400, message: 'Липсват задължителни полета' };

    if (tax < 0 || tax > 100)
        return { status: 400, message: 'Невалидна данъчна ставка' };

    if (!bank.name || !bank.code || !bank.iban || bank.iban.length > 34)
        return { status: 400, message: 'Невалидни банкови данни' };
}

export const CompanyController = {
    get: async (query) => {
        const companies = await Company.find().sort({ default: -1 }).lean(); // lean returns normal js object that we can modify

        if (query.canBeDeleted == 'true') {
            for (let company of companies) {
                const bool = await Order.findOne({ company });
                company.canBeDeleted = bool;
            }
        }

        return companies;
    },
    getById: async (id) => {
        const company = await Company.findById(id);
        if (!company) return { status: 404, message: 'Фирмата не е намерена' };
        return { company, status: 200 };
    },
    post: async (data) => {
        const validation = validateCompany(data);

        if (validation) return validation;

        const existingVat = await Company.findOne({ vat: data.vat });
        if (existingVat) return { status: 400, message: 'Фирма с този ЕИК вече съществува' };

        const existingTaxVat = data.taxvat ? await Company.findOne({ taxvat: data.taxvat }) : null;
        if (existingTaxVat) return { status: 400, message: 'Фирма с този ДДС ЕИК вече съществува' };

        // check if no companies exist and set as default
        const companies = await Company.find();
        if (companies.length === 0) data.default = true;

        // Add MOL to senders so it autofills on first order
        data.senders = [data.mol];

        await new Company(data).save();
        return { status: 201 };
    },
    put: async (id, data) => {
        const validation = validateCompany(data);

        if (validation) return validation;

        const existingVat = await Company.findOne({ vat: data.vat });
        if (existingVat && existingVat._id.toString() !== id)
            return { status: 400, message: 'Фирма с този ЕИК вече съществува' };

        const existingTaxVat = data.taxvat ? await Company.findOne({ taxvat: data.taxvat }) : null;
        if (existingTaxVat && existingTaxVat._id.toString() !== id)
            return { status: 400, message: 'Фирма с този ДДС ЕИК вече съществува' };

        // Add new MOL to receivers array
        const companyOld = await Company.findById(id);

        if (data.mol && !companyOld.senders.includes(data.mol)) // if new mol add to receivers
            data.senders = [...companyOld.senders, data.mol];

        await companyOld.updateOne(data);
        return { status: 201 };
    },
    delete: async (id) => {
        const company = await Company.findById(id);
        if (!company) return { status: 404, message: 'Фирмата не е намерена' };

        const hasDocuments = (await Order.find({ company: company }).limit(1)).length > 0;

        if (hasDocuments) return { status: 400, message: 'Тази фирма има издадени документи и не може да бъде изтрита!' };

        if (company.default === true) {
            // set another company as default
            const newDefaultCompany = await Company.findOne({ _id: { $ne: company._id } });
            if (newDefaultCompany) {
                newDefaultCompany.default = true;
                await newDefaultCompany.save();
            }
        }

        await company.deleteOne();

        return { status: 204 };
    },
    setDefault: async (id) => {
        const company = await Company.findById(id);
        if (!company) return { status: 404, message: 'Фирмата не е намерена' };

        // Find and reset default company
        await Company.findOneAndUpdate({ default: true }, { default: false });

        company.default = true;

        await company.save();

        return { status: 201 };
    }
}