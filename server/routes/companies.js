import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { Company } from "../models/company.js";
import { Order } from "../models/order.js";
import { CompanyController } from "../controllers/companies.js";

export function companiesRoutes() {
    const companiesRouter = express.Router();

    companiesRouter.get('/companies', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const companies = await CompanyController.get(req.query);

            res.json(companies);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.get('/companies/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { company, status, message } = await CompanyController.getById(req.params.id);

            if (status !== 200) return res.status(status).send(message);

            res.json(company);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.post('/companies', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await CompanyController.post({ ...req.body });

            if (status !== 201) return res.status(status).send(message);

            res.status(201).send();
        } catch (error) {
            console.log(error);
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.put('/companies/:id', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await CompanyController.put(req.params.id, { ...req.body });

            if (status !== 201) return res.status(status).send(message);

            res.status(201).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }

    });

    companiesRouter.delete('/companies/:id', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await CompanyController.delete(req.params.id);

            if (status !== 204) return res.status(status).send(message);

            res.status(204).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    companiesRouter.put('/companies/:id/default', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await CompanyController.setDefault(req.params.id);
            if (status !== 201) return res.status(status).send(message);

            res.status(201).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, companiesRouter);
}