import mongoose from "mongoose";
import { imageSchema } from "./product.js";

const { Schema } = mongoose;

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    path: {
        type: String,
        default: null,
    },
    order: {
        type: Number,
        default: 0
    },
    image: imageSchema,
    woocommerce: [
        {
            _id: false,
            woo_url: String,
            id: String,
        },
    ]
});


const Category = mongoose.model('Category', categorySchema);

export { Category };