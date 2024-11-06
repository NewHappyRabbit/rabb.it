import mongoose from "mongoose";

const { Schema } = mongoose;

export const documentTypes = {
    invoice: 'Фактура',
    stokova: 'Стокова разписка',
    proforma: 'Проформа фактура',
    credit: 'Кредитно известие'
}

export const woocommerce = {
    status: {
        pending: 'Получена',
        processing: "В обработка",
        completed: 'Приключена',
        cancelled: 'Отказана',
        refunded: 'Върната',
    },
    payment_method: {
        // Woo : App
        cod: 'cash',
    }
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

const orderSchema = new Schema({
    number: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    taxEventDate: {
        type: Date,
        required: true,
        default: new Date()
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
            quantity: { // quantity or packages or when existing variable its used as quantity for each size
                type: Number,
            },
            qtyInPackage: Number, // quantity in package (used when product doesnt exist in DB and is created on the fly in orders),
            unitOfMeasure: {
                type: String,
                required: true
            },
            selectedSizes: [String], // This is used when a variable existing product is used, stores each seleted size name
            size: {// if retail order, size must be selected
                type: String,
                required: function () {
                    return this.orderType === 'retail';
                }
            },
            multiplier: Number,
            price: { // price without discount
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
    },
    woocommerce: {
        id: String,
        shipping: String,
        status: {
            type: String,
            required: function () {
                return this.woocommerce.id;
            },
        },
        payment_method: {
            type: String,
            required: function () {
                return this.woocommerce.id;
            },
        },
        payment_method_title: {
            type: String,
            required: function () {
                return this.woocommerce.id;
            },
        },
        speedy: {
            country: String,
            locality: String,
            postal_code: String,
            total: Number,
            office: String,
            street: String,
            number: String,
            entrance: String,
            floor: String,
            apartment: String,
            note: String
        },
        econt: {
            ship_to: String,
            city: String,
            postal_code: String,
            total: Number,
            office: String,
            street: String,
            number: String,
            entrance: String,
            floor: String,
            apartment: String,
            note: String
        }
    },
    // the below settings are for credit orders
    returnQuantity: {
        type: Boolean,
        required: function () {
            return this.type === 'credit';
        }
    },
    creditForNumber: {
        type: String,
        required: function () {
            return this.type === 'credit';
        }
    },
    creditFromDate: {
        type: Date,
        required: function () {
            return this.type === 'credit';
        }
    }
}, {
    timestamps: true
});

export const Order = mongoose.model('Order', orderSchema);