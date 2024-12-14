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

const defaultUnitOfMeasure = 'пакет';

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
    unitOfMeasure: {
        type: String,
        default: defaultUnitOfMeasure,
    },
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
    multiplier: {
        type: Number,
        match: [/^\d*$/, 'Множителя трябва да е просто число: пример 1, 5, 50'],
        default: 1,
    },
    sizes: [
        {
            _id: false,
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
            },
            woocommerce: [{
                _id: false,
                woo_url: String,
                id: String, // Variation ID (from retail woocommerce)
            }],
        },
    ],
    openedPackages: {
        type: Boolean,
        default: function () {
            if (this.sizes?.length > 0)
                return this?.sizes?.some(s => s.quantity !== this.sizes[0].quantity);
            else if (this.sizes?.length === 0)
                return undefined;
        }
    },
    upsaleAmount: {
        type: Number,
        default: 0,
    },
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
        validate: {
            validator: function (v) {
                if (this.sizes.length === 0)
                    return v > this.deliveryPrice;

                return v > (this.deliveryPrice / (this.sizes.length * this.multiplier)).toFixed(2);
            },
            message: 'Цената на дребно трябва да е по-голяма от доставната цена!'
        },
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
    woocommerce: [{
        _id: false,
        woo_url: String,
        id: String,
        permalink: String,
    }],
    attributes: [
        {
            attribute: {
                type: Schema.Types.ObjectId,
                ref: 'ProductAttribute',
                required: true,
            },
            value: [{
                type: String,
                required: true
            }],
        },
        {
            _id: false
        }
    ]

    //TODO Implement in the future
    //sale_price
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);

export { Product };