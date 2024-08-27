import mongoose from "mongoose";

const { Schema } = mongoose;

export const userRoles = {
    user: 'Потребител',
    manager: 'Мениджър',
    admin: 'Администратор',
};

//TODO DELETE BELOW, its purely for reference
const rolePermissions = {
    user: {
        orders: ['create', 'view', 'print'],
        products: ['create', 'view', 'restock', 'print'],
        customers: ['create', 'view'],
        categories: ['view'],
    },
    manager: {
        orders: ['create', 'view', 'print', 'edit'],
        products: ['create', 'view', 'restock', 'print', 'edit'],
        customers: ['create', 'view', 'edit'],
        categories: ['view', 'create', 'edit'],
        references: ['view']
    },
    admin: {
        orders: ['create', 'view', 'print', 'edit', 'delete'],
        products: ['create', 'view', 'restock', 'print', 'edit', 'delete'],
        customers: ['create', 'view', 'edit', 'delete'],
        categories: ['view', 'create', 'edit', 'delete'],
        references: ['view'],
        users: ['view', 'create', 'edit', 'delete'],
        companies: ['view', 'create', 'edit', 'delete'],
        settings: ['view', 'edit'],
    },
};

const userSchema = new Schema({
    username: {
        type: String,
        unique: true,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: Object.keys(userRoles),
        default: Object.keys(userRoles)[0],
        required: true
    },
    deleted: Boolean
})

export const User = mongoose.model('User', userSchema);