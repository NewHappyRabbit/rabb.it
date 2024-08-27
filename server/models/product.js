import mongoose from "mongoose";

const { Schema } = mongoose;

export const imageSchema = new Schema({
    path: {
        type: String,
        required: true,
    },
    url: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return v.startsWith('https://');
            },
            message: 'Линкът на изображението трябва да започва с https:\/\/!'
        }
    }
}, { _id: false });

const productSchema = new Schema({
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    noInvoice: { // if product was bought without an invoice (cant be sold in invoices, only in POS system)
        type: Boolean,
        default: false,
        required: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
    },
    barcode: {
        type: String,
        unique: true,
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    quantity: {
        type: Number,
        match: [/^\d*$/, 'Пакетите трябва да са просто число: пример 5, 50'],
        required: true
    },
    minQty: {
        type: Number,
        match: [/^\d*$/, 'Минималните пакети трябва да са просто число: пример 5, 50'],
        default: 0,
    },
    sizes: [
        {
            size: {
                type: String,
                required: true,
            },
            quantity: {
                type: Number,
                match: [/^\d*$/, 'Количеството трябва да е просто число: пример 5, 50'],
                required: true,
                default: function () {
                    return this.quantity;
                }
            }
        },
    ],
    deliveryPrice: {
        type: Number,
        match: [/^\d{1,}(\.\d{1,2})?$/, 'Цената трябва да е: пример 5.0, 3, 1.20!'],
        required: true,
    },
    wholesalePrice: {
        type: Number,
        match: [/^\d{1,}(\.\d{1,2})?$/, 'Цената трябва да е: пример 5.0, 3, 1.20!'],
        required: true,
        validate: {
            validator: function (v) {
                return v > this.deliveryPrice;
            },
            message: 'Цената на едро трябва да е по-голяма от доставната цена!'
        }
    },
    retailPrice: {
        type: Number,
        match: [/^\d{1,}(\.\d{1,2})?$/, 'Цената трябва да е: пример 5.0, 3, 1.20!'],
        required: true,
    },
    hidden: {
        type: Boolean,
        default: false,
        required: true,
    },
    image: imageSchema,
    additionalImages: [imageSchema],
    deleted: {
        type: Boolean,
        default: false
    },
    outOfStock: {
        type: Boolean,
        default: false,
    },
    wooId: String,
    wooPermalink: String,

    //TODO Implement in the future
    //sale_price
});

const Product = mongoose.model('Product', productSchema);

export { Product };