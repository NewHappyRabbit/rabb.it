import { permit } from "../middleware/auth.js";
import { app, basePath } from '../app.js';
import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";
import { User, userRoles } from '../models/user.js';
import express from 'express';
import { Sale } from "../models/sale.js";
const jwtSecret = process.env.JWT_SECRET;

async function createDefaultUsers() {
    // Check if any users exists to prevent errors on new deploys
    const exist = await User.findOne();

    if (exist) return;
    const pass = await bcrypt.hash('123456', 10);
    await User.create({ username: 'admin', password: pass, role: 'admin' });
    console.log('Created default user "admin" with password "123456"')
}

export function usersRoutes() {
    createDefaultUsers();
    const usersRouter = express.Router();

    usersRouter.get('/users', permit('admin'), async (req, res) => {
        try {
            const users = await User.find().select("-password");
            res.status(200).json(users);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.get('/users/roles', permit('admin'), async (req, res) => {
        try {
            res.json(userRoles);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.get('/users/:id', permit('admin'), async (req, res) => {
        try {
            const id = req.params.id;
            const user = await User.findById(id).select("-password");
            res.status(200).json(user);
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.post('/users', permit('admin'), async (req, res) => {
        try {
            var { username, password, password2, role } = { ...req.body };

            if (!username)
                return res.status(400).send("Липсва потребителско име");

            if (password.length < 6)
                return res.status(400).send("Паролата трябва да е поне 6 символа");

            if (password !== password2)
                return res.status(400).send("Паролите не съвпадат");

            if (!role || Object.keys(userRoles).indexOf(role) === -1)
                return res.status(400).send("Грешка при избора на роля");

            username = username.toLowerCase();
            const exists = await User.find({ username });

            if (exists.length > 0)
                return res.status(400).send("Потребител с това име вече съществува")
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await User.create({
                username,
                password: hashedPassword,
                role
            });

            res.status(201).send();
            req.log.info({ username, role, _id: user._id }, 'User created');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.put('/users/:id', permit('admin'), async (req, res) => {
        try {
            const id = req.params.id;
            const user = await User.findById(req.params.id).select("-password");
            if (!user)
                return res.status(404).send('Потребителят не е намерен');

            const { username, password, password2, role } = { ...req.body };

            if (!username)
                return res.status(400).send("Липсва потребителско име");

            const exists = await User.find({ username, _id: { $ne: id } });
            if (exists.length > 0)
                return res.status(400).send("Потребител с това име вече съществува")

            if (password && password.length < 6)
                return res.status(400).send("Паролата трябва да е поне 6 символа");

            if (password && password !== password2)
                return res.status(400).send("Паролите не съвпадат");

            if (!role || Object.keys(userRoles).indexOf(role) === -1)
                return res.status(400).send("Грешка при избора на роля");

            const newData = {
                username,
                role
            };

            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                newData.password = hashedPassword;
            }

            await user.updateOne(newData);

            res.status(201).json(user);
            req.log.info({ username, role, _id: user._id }, 'User updated');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.delete('/users/:id', permit('admin'), async (req, res) => {
        try {
            const { id } = req.params;
            const user = await User.findById(id);

            if (!user)
                return res.status(404).send("Потребителят не е намерен")

            const inSale = await Sale.findOne({ user: id });
            if (inSale)
                return res.status(400).send("Потребителят има продажби и не може да бъде изтрит");

            await user.deleteOne();

            res.status(204).send();
            req.log.info({ username: user.username, _id: user._id }, 'User deleted');
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.post('/login', async (req, res) => {
        try {
            var { username, password } = req.body;

            if (!username)
                return res.status(400).send("Въведете потребителско име")

            if (!password)
                return res.status(400).send("Въведете парола")

            username = username.toLowerCase();

            const user = await User.findOne({ username });

            if (!user)
                return res.status(401).send("Потребителят не е намерен")

            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid)
                return res.status(401).send("Грешна парола")

            const maxAge = 12 * 60 * 60; //  12 hours
            const token = jwt.sign(
                { id: user._id, username, role: user.role },
                jwtSecret,
                {
                    expiresIn: maxAge, // in seconds
                }
            );

            res.cookie("jwt", token, {
                httpOnly: true,
                maxAge: maxAge * 1000, // in milliseconds
            });

            res.status(200).json({
                message: "User logged in successfully",
                user: { id: user._id, username, role: user.role },
                maxAge,
            });
        } catch (error) {
            req.log.debug({ body: req.body }) // Log the body of the request
            res.status(500).send(error);
        }
    });

    usersRouter.get("/logout", (req, res) => {
        res.cookie("jwt", "", { maxAge: "1" })
        res.status(200).send("Logged out");
    })

    app.use(basePath, usersRouter);
}