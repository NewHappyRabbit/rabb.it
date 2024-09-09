import { documentTypes, orderTypes, paymentTypes } from "../models/order.js";
import { Setting } from "../models/setting.js";

export async function createDefaultSettings() {
    const defaultSettings = {
        wholesaleMarkup: '30',
        retailMarkup: '55',
        orderType: Object.keys(orderTypes)[0],
        paymentType: Object.keys(paymentTypes)[0],
        documentType: Object.keys(documentTypes)[0],
        orderPrint: "original", // can be original, originalCopy or originalCopyStokova
        deliveryPriceFields: 'unit', // which input field to show in product create page (can be whole - only whole package, unit - only unit price, both - both)
        wholesalePriceFields: 'unit', // which input field to show in product create page (can be whole - only whole package, unit - only unit price, both - both)
        retailPriceField: 'true', // show retail price in product create page
        wooDocumentType: Object.keys(documentTypes)[0] // default type to assign to wooOrder when importing to app
    }

    for (const [key, value] of Object.entries(defaultSettings)) {
        const setting = await Setting.findOne({ key });

        if (!setting) await Setting.create({ key, value });
    }
}

export const SettingsController = {
    get: async (query) => {
        const keys = query.keys || undefined;
        const dbQuery = keys ? { key: { $in: keys } } : {};

        const settings = await Setting.find(dbQuery);

        return settings;
    },
    put: async (data) => {
        for (let [key, value] of Object.entries(data)) {
            const setting = await Setting.findOne({ key });

            if (key === 'wholesaleMarkup' || key === 'retailMarkup') {
                value = Number(value);
                if (isNaN(value) || value < 0) continue;
            }

            if (key === 'orderType' && !Object.keys(orderTypes).includes(value)) continue;

            if (key === 'paymentType' && !Object.keys(paymentTypes).includes(value)) continue;

            if (key === 'documentType' && !Object.keys(documentTypes).includes(value)) continue;

            if (key === 'orderPrint' && !["original", "originalCopy", "originalCopyStokova"].includes(value)) continue;

            if (key === 'deliveryPriceFields' && !["whole", "unit", "both"].includes(value)) continue;

            if (key === 'wholesalePriceFields' && !["whole", "unit", "both"].includes(value)) continue;

            if (key === 'retailPriceField' && !["true", "false"].includes(value)) continue;

            if (setting && key && value) await Setting.updateOne({ _id: setting._id }, { value });
        }
    }
}