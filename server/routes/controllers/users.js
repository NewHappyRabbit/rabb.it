import bcrypt from "bcryptjs";
import { User, userRoles } from "../../models/user.js";
import { Order } from "../../models/order.js";
import jwt from 'jsonwebtoken';

export async function createDefaultUsers() {
    // Check if any users exists to prevent errors on new deploys
    const exist = await User.findOne();

    if (exist) return;
    const pass = await bcrypt.hash('123456', 10);
    await User.create({ username: 'admin', password: pass, role: 'admin' });
    console.log('Created default user "admin" with password "123456"')
}

const jwtSecret = process.env.JWT_SECRET;
export const UserController = {
    get: async () => {
        const users = await User.find().select("-password");
        return users;
    },
    getRoles: () => {
        return userRoles;
    },
    getById: async (id) => {
        const user = await User.findById(id).select("-password");

        return user;
    },
    post: async ({ username, password, password2, role }) => {
        if (!username) return { status: 400, message: "Липсва потребителско име" };

        if (password.length < 6) return { status: 400, message: "Паролата трябва да е поне 6 символа" };

        if (password !== password2) return { status: 400, message: "Паролите не съвпадат" };

        if (!role || Object.keys(userRoles).indexOf(role) === -1) return { status: 400, message: "Грешка при избора на роля" };

        username = username.toLowerCase();

        const exists = await User.find({ username });
        if (exists.length > 0) return { status: 400, message: "Потребител с това име вече съществува" };

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            username,
            password: hashedPassword,
            role
        });

        return { status: 201 };
    },
    put: async ({ id, username, password, password2, role }) => {
        const user = await User.findById(id).select("-password");
        if (!user) return { status: 404, message: "Потребителят не е намерен" };

        if (!username) return { status: 400, message: "Липсва потребителско име" };

        const exists = await User.find({ username, _id: { $ne: id } });
        if (exists.length > 0) return { status: 400, message: "Потребител с това име вече съществува" };

        if (password && password.length < 6) return { status: 400, message: "Паролата трябва да е поне 6 символа" };

        if (password && password !== password2) return { status: 400, message: "Паролите не съвпадат" };

        if (!role || Object.keys(userRoles).indexOf(role) === -1) return { status: 400, message: "Грешка при избора на роля" };

        const newData = {
            username,
            role
        };

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            newData.password = hashedPassword;
        }

        await user.updateOne(newData);

        return { status: 201 };
    },
    delete: async (id) => {
        const user = await User.findById(id);

        if (!user) return { status: 404, message: "Потребителят не е намерен" };

        const inSale = await Order.findOne({ user: id });
        if (inSale) return { status: 400, message: "Потребителят има продажби и не може да бъде изтрит" };

        await user.deleteOne();

        return { status: 204 };
    },
    login: async ({ username, password }) => {
        if (!username) return { status: 400, message: "Въведете потребителско име" }

        if (!password) return { status: 400, message: "Въведете парола" }

        username = username.toLowerCase();

        const user = await User.findOne({ username });

        if (!user) return { status: 401, message: "Потребителят не е намерен" }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) return { status: 401, message: "Грешна парола" }

        const maxAge = 12 * 60 * 60; //  12 hours
        const token = jwt.sign(
            { id: user._id, username, role: user.role },
            jwtSecret,
            {
                expiresIn: maxAge, // in seconds
            });

        return { status: 200, token, maxAge, id: user._id, username, role: user.role };
    },
}