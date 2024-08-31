import { Setting } from "../../models/setting.js";

export async function createDefaultSettings() {
    // Check if the settings exist in the database to prevent errors on new deploys
    var exist = await Setting.findOne({ key: 'wholesaleMarkup' });
    if (!exist) await Setting.create({ key: 'wholesaleMarkup', value: '20' });

    exist = await Setting.findOne({ key: 'retailMarkup' });
    if (!exist) await Setting.create({ key: 'retailMarkup', value: '50' });
    else return; // on last setting

    console.log('Default settings created');
}

export const SettingsController = {
    get: async (query) => {
        const keys = query.keys || undefined;
        const dbQuery = keys ? { key: { $in: keys } } : {};

        const settings = await Setting.find(dbQuery);

        return settings;
    },
    put: async (data) => {
        for (const [key, value] of Object.entries(data)) {
            const setting = await Setting.findOne({ key });

            if (!setting && value)
                await Setting.create({ key, value });
            else if (setting && value) {
                setting.value = value;
                await setting.save();
            } else if (setting && !value && !['wholesaleMarkup', 'retailMarkup'].includes(key)) {
                await Setting.deleteOne(setting);
            }
        }
    }
}