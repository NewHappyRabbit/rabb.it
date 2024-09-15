import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { CustomerController } from "../controllers/customers.js";

export function customersRoutes() {
    const customersRouter = express.Router();

    customersRouter.get('/customers', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { cursor, search, showDeleted, page } = req.query;
            const { customers, prevCursor, nextCursor, status, message } = await CustomerController.get({ cursor, search, showDeleted, page });

            if (status !== 200) return res.status(status).send(message);

            res.json({ customers, prevCursor, nextCursor });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.get('/customers/:id', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { customer, status, message } = await CustomerController.findById(req.params.id);
            if (status !== 200) return res.status(status).send(message);

            res.json(customer);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.post('/customers', permit('user', 'manager', 'admin'), async (req, res) => {
        try {
            const { status, message } = await CustomerController.post({ ...req.body });
            if (status !== 201) return res.status(status).send(message);

            res.status(201).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.put('/customers/:id', permit('manager', 'admin'), async (req, res) => {
        try {
            const { status, message } = await CustomerController.put(req.params.id, { ...req.body });
            if (status !== 201) return res.status(status).send(message);

            res.status(201).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }

    });

    customersRouter.delete('/customers/:id', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await CustomerController.delete(req.params.id);
            if (status !== 204) return res.status(status).send(message);

            res.status(204).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    customersRouter.put('/customers/:id/unhide', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await CustomerController.unhide(req.params.id);
            if (status !== 201) return res.status(status).send(message);

            res.status(201).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    app.use(basePath, customersRouter);
}