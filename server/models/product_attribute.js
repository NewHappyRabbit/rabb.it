import mongoose from "mongoose";

const { Schema } = mongoose;

const productAttribute = new Schema({
    name: {
        type: String,
        required: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    order_by: {
        type: String,
        required: true,
        default: 'name_num'
    },
    woocommerce: {
        id: String,
    }
});


const ProductAttribute = mongoose.model('ProductAttribute', productAttribute);

export { ProductAttribute };