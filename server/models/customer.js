import mongoose from "mongoose";

const { Schema } = mongoose;

const customerSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    mol: String,
    phone: String,
    email: {
        type: String,
        match: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
    },
    vat: {
        type: String,
        sparse: true,
        unique: true,
    },
    taxvat: String, // example: BG123123123
    address: String,
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
    },
    woocommerce: [{
        woo_url: String,
        id: String,
    }]
});

const Customer = mongoose.model('Customer', customerSchema);

export { Customer };