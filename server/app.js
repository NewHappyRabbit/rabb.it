import 'dotenv/config';
import express from 'express';
import { mongoConfig } from './config/database.js';
import { corsURLS, expressConfig } from './config/express.js';
import { loadRoutes } from './routes/routes.js';
import http from 'http';
import { Server } from "socket.io";
import { productSockets } from './routes/products.js';
import { convertBGNtoEUR } from './functions/dev.js';

// Check if all required environment variables are defined
let missingVariables = [];
['ENV', 'URL', 'MONGO_USER', 'MONGO_PASSWORD', 'MONGO_URI', 'JWT_SECRET'].forEach((env) => {
    if (!process.env[env]) missingVariables.push(env);
});
if (missingVariables.length) throw new Error(`Missing environment variables: ${missingVariables.join(',')}`);

// Check if all or none of WooCommerce variables are defined
const shops = process.env.WOO_SHOPS ? JSON.parse(process.env.WOO_SHOPS) : [];
for (let shop of shops) {
    let missingWooVariables = [];
    ['WOO_URL', 'WOO_KEY', 'WOO_SECRET', 'WOO_HOOKS_SECRET', 'custom'].forEach((env) => {
        if (!shop[env]) missingWooVariables.push(env);
    })
    if (missingWooVariables.length > 0 && missingWooVariables.length < 5) throw new Error(`Missing WOO environment variables: ${missingWooVariables.join(',')}`);

    console.log(`Succesfully loaded Woo store: ${shop.WOO_URL}`);
}


export const app = express();

// Set base path for all routes
export const basePath = '/';

await mongoConfig();
expressConfig();
loadRoutes();


const port = 3000;
const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Node listening on port ${port}! Environment is: ${process.env.ENV}`);
});

// Socket.io
const socketIoPath = '/socket.io/';
export const io = new Server(server, {
    cors: {
        origin: corsURLS,
        credentials: true
    },
    transports: ['websocket', 'polling'],
    path: socketIoPath,
    allowEIO3: true,
});

io.on('connection', (socket) => {
    socket.emit('connected', socket.id);

    productSockets(socket);
});