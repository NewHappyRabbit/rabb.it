import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Setting } from "../models/setting.js";

async function createDefaultSettings() {
    // Check if the settings exist in the database to prevent errors on new deploys
    var exist = await Setting.findOne({ key: 'wholesaleMarkup' });
    if (!exist) await Setting.create({ key: 'wholesaleMarkup', value: '20' });

    exist = await Setting.findOne({ key: 'retailMarkup' });
    if (!exist) await Setting.create({ key: 'retailMarkup', value: '50' });
    else return; // on last setting

    console.log('Default settings created');
}

export function settingsRoutes() {
    createDefaultSettings();
    const settingsRouter = express.Router();

    settingsRouter.get('/settings', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const keys = req.query.keys || '';
            const query = keys ? { key: { $in: keys } } : {};

            const settings = await Setting.find(query);

            res.json(settings);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    settingsRouter.put('/settings', permit('admin'), async (req, res) => {
        try {
            const data = { ...req.body };

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

            res.status(201).send();
            res.log.info(data, 'Settings updated');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, settingsRouter);
}