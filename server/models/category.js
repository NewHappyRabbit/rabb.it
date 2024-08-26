import mongoose from "mongoose";

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
    image: String,
    wooId: String
});


const Category = mongoose.model('Category', categorySchema);

export { Category };