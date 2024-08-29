import mongoose from "mongoose";
import { sparseFix } from "./functions/global.js";

const { Schema } = mongoose;

const customerSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    mol: {
        type: String,
        required: true,
    },
    phone: String,
    email: {
        type: String,
        match: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
    },
    vat: {
        type: String,
        required: true,
        unique: true,
        match: /^[0-9]{9,10}$/,
    },
    taxvat: { // example: BG123123123
        type: String,
        required: false,
        index: {
            unique: true,
            sparse: true
        },
    },
    address: {
        type: String,
        required: true
    },
    deliveryAddress: String,
    discount: {
        type: Number,
        min: 0,
        match: /^(\d)+(\.\d{0,2}){0,1}$/
    },
    receivers: [String], // array of receiver names for documents
    deleted: { // used for soft delete
        type: Boolean,
        default: false,
    }
});

sparseFix(customerSchema, 'taxvat');

const Customer = mongoose.model('Customer', customerSchema);

export { Customer };