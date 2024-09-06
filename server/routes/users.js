import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import express from 'express';
import { createDefaultUsers, UserController } from "../controllers/users.js";


export function usersRoutes() {
    createDefaultUsers();
    const usersRouter = express.Router();

    usersRouter.get('/users', permit('admin'), async (req, res) => {
        try {
            const users = await UserController.get();
            res.status(200).json(users);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.get('/users/roles', permit('admin'), async (req, res) => {
        try {
            res.json(UserController.getRoles());
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.get('/users/:id', permit('admin'), async (req, res) => {
        try {
            const user = await UserController.getById(req.params.id);
            res.status(200).json(user);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.post('/users', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await UserController.post({ ...req.body });
            if (status !== 201)
                return res.status(status).send(message);

            res.status(status).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.put('/users/:id', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await UserController.put({ id: req.params.id, ...req.body });
            if (status !== 201)
                return res.status(status).send(message);

            res.status(status).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.delete('/users/:id', permit('admin'), async (req, res) => {
        try {
            const { status, message } = await UserController.delete(req.params.id);
            if (status !== 204) return res.status(status).send(message);

            res.status(status).send();
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.post('/login', async (req, res) => {
        try {
            const { token, maxAge, username, id, role, status, message } = await UserController.login(req.body);

            if (status !== 200) return res.status(status).send(message);

            res.cookie("jwt", token, {
                httpOnly: true,
                maxAge: maxAge * 1000, // in milliseconds
                sameSite: 'none', // this and the below line fixes cookie not being set on frontend
                secure: true
            });

            res.status(200).json({
                user: { id, username, role },
                maxAge,
            });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.get("/logout", (req, res) => {
        res.cookie("jwt", "", { maxAge: "1" })
        res.status(200).send('');
    })

    app.use(basePath, usersRouter);
}