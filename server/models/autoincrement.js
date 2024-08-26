import mongoose from "mongoose";

const { Schema } = mongoose;

const autoincrementSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    seq: {
        type: Number,
        default: 0,
        required: true
    },
    company: { // Used in documents so each company has their own sequence
        type: Schema.Types.ObjectId,
        ref: 'Company',
    }
});

const AutoIncrement = mongoose.model('AutoIncrement', autoincrementSchema);

export { AutoIncrement };