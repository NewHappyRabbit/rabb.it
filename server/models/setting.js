import mongoose from "mongoose";

const { Schema } = mongoose;

const settingSchema = new Schema({
    key: {
        type: String,
        required: true,
        unique: true,
    },
    value: {
        type: String,
        required: true,
    },
});

const Setting = mongoose.model('Setting', settingSchema);

export { Setting };