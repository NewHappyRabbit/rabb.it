import { Company } from "../models/company.js";
import { Order } from "../models/order.js";

function validateCompany(data) {
    const { name, bank, mol, vat, address, tax } = data;
    if (!name) return { status: 400, message: 'Въведете име', property: 'name' };

    if (!bank || !bank?.name || !bank?.code || !bank?.iban) return { status: 400, message: 'Въведете банкови данни', property: 'bank' };

    if (!mol) return { status: 400, message: 'Въведете мол', property: 'mol' };

    if (!address) return { status: 400, message: 'Въведете адрес', property: 'address' };

    if (!vat || vat?.length < 9 || vat?.length > 9) return { status: 400, message: 'Невалиден ЕИК', property: 'vat' };

    if (tax < 0 || tax > 100)
        return { status: 400, message: 'Невалидна данъчна ставка', property: 'tax' };
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
        if (existingVat) return { status: 400, message: 'Фирма с този ЕИК вече съществува', property: 'vat' };

        const existingTaxVat = data.taxvat ? await Company.findOne({ taxvat: data.taxvat }) : null;
        if (existingTaxVat) return { status: 400, message: 'Фирма с този ДДС ЕИК вече съществува', property: 'taxvat' };

        // check if no companies exist and set as default
        const companies = await Company.find();
        if (companies.length === 0) data.default = true;

        // Add MOL to senders so it autofills on first order
        data.senders = [data.mol];

        const company = await new Company(data).save();
        return { status: 201, company };
    },
    put: async (id, data) => {
        const validation = validateCompany(data);

        if (validation) return validation;

        const existingVat = await Company.findOne({ vat: data.vat });
        if (existingVat && existingVat._id.toString() !== id)
            return { status: 400, message: 'Фирма с този ЕИК вече съществува', property: 'vat' };

        const existingTaxVat = data.taxvat ? await Company.findOne({ taxvat: data.taxvat }) : null;
        if (existingTaxVat && existingTaxVat._id.toString() !== id)
            return { status: 400, message: 'Фирма с този ДДС ЕИК вече съществува', property: 'taxvat' };

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

        if (hasDocuments) return { status: 400, message: 'Тази фирма има издадени документи и не може да бъде изтрита!', property: 'orders' };

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