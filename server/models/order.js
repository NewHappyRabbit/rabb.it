import mongoose from "mongoose";

const { Schema } = mongoose;

export const documentTypes = {
    invoice: 'Фактура',
    stokova: 'Стокова разписка',
    proforma: 'Проформа фактура',
    credit: 'Кредитно известие'
}

export const paymentTypes = {
    cash: 'В брой',
    bank: 'По сметка',
    card: 'С карта',
    mix: 'Смесен',
    courier: 'Наложен платеж',
    other: 'Друго'
}

export const orderTypes = {
    wholesale: 'Едро',
    retail: 'Дребно',
}

const saleSchema = new Schema({
    number: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    type: {
        type: String,
        enum: Object.keys(documentTypes),
        required: true,
        default: Object.keys(documentTypes)[0]
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    orderType: {
        type: String,
        enum: Object.keys(orderTypes),
        required: true,
        default: Object.keys(orderTypes)[0]
    },
    products: [
        {
            product: { // reference to product if it exists in db
                type: Schema.Types.ObjectId,
                ref: 'Product'
            },
            name: String, // if product doesnt exist in db and is created on the fly in orders
            quantity: { // quantity or packages
                type: Number,
                required: true,
                min: 1
            },
            qtyInPackage: { // quantity in package (used when product doesnt exist in DB and is created on the fly in orders)
                type: Number,
            },
            size: {// if retail order, size must be selected
                type: String,
                required: function () {
                    return this.orderType === 'retail';
                }
            },
            price: { // price per package/quantity without discount
                type: Number,
                required: true,
                min: 0.1
            },
            discount: Number, // discount in percent (ex. 20, 50)
        }
    ],
    paymentType: {
        type: String,
        enum: Object.keys(paymentTypes),
        required: true,
        default: Object.keys(paymentTypes)[0]
    },
    paidAmount: {
        type: Number,
        required: true,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    unpaid: {
        type: Boolean,
        required: true,
        default: true
    },
    company: { // which company that issued the document
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    user: { // which user created the document
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: { // name of the person that received the document
        type: String,
        required: true
    },
    sender: {
        type: String,
        required: true
    },
    deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

export const Order = mongoose.model('Order', saleSchema);