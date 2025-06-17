import mongoose from "mongoose";

async function mongoConfig() {
    const user = process.env.MONGO_USER;
    const pass = process.env.MONGO_PASSWORD;
    const uri = process.env.MONGO_URI;
    const env = process.env.ENV;

    const options = {
        user,
        pass,
        dbName: env,
        authSource: 'admin',
        autoIndex: true
        // autoIndex: env === 'dev'
    }


    mongoose.connection.on('connected', () => {
        console.log("MongoDB connected successfully!");
    });

    await mongoose.connect(uri, options)
        .then(console.log('Connecting to MongoDB at ' + uri))
        .catch(err => async () => {
            {
                if (env === 'test') throw new Error('Error connecting to MongoDB: ' + err)
                console.error('Error connecting to MongoDB: ' + err)
                await mongoose.disconnect();
            }
        });
}

export { mongoConfig };