import mongoose from "mongoose";

const { Schema } = mongoose;

const companySchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    bank: {
        name: {
            type: String,
            required: true,
        },
        code: {
            type: String,
            required: true,
        },
        iban: {
            type: String,
            required: true,
        },
    },
    mol: {
        type: String,
        required: true,
    },
    phone: String,
    vat: {
        type: String,
        required: true,
        unique: true,
        match: /^[0-9]{9}$/,
    },
    taxvat: { // example: BG123123123
        type: String,
        required: false,
        index: {
            unique: true,
            sparse: true
        },
    },
    tax: {
        type: Number,
        required: true,
        default: 20,
    },
    address: {
        type: String,
        required: true
    },
    senders: [String], // array of sender names for documents
    default: {
        type: Boolean,
        default: false,
    },
});

const Company = mongoose.model('Company', companySchema);

export { Company };