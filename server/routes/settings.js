import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { SettingsController, createDefaultSettings } from "../controllers/settings.js";

export function settingsRoutes() {
    createDefaultSettings();
    const settingsRouter = express.Router();

    settingsRouter.get('/settings', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const settings = await SettingsController.get(req.query);

            res.json(settings);
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    settingsRouter.put('/settings', permit('admin'), async (req, res) => {
        try {
            const data = { ...req.body };

            await SettingsController.put(data);

            res.status(201).send();
        } catch (error) {
            console.error(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, settingsRouter);
}