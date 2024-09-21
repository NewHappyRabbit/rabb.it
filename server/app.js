import 'dotenv/config';
import express from 'express';
import { mongoConfig } from './config/database.js';
import { corsURLS, expressConfig } from './config/express.js';
import { loadRoutes } from './routes/routes.js';
import http from 'http';
import { Server } from "socket.io";
import { productSockets } from './routes/products.js';

// Check if all required environment variables are defined
let missingVariables = [];
['ENV', 'URL', 'MONGO_USER', 'MONGO_PASSWORD', 'MONGO_URI', 'JWT_SECRET'].forEach((env) => {
    if (!process.env[env]) missingVariables.push(env);
});
if (missingVariables.length) throw new Error(`Missing environment variables: ${missingVariables.join(',')}`);

// Check if all or none of WooCommerce variables are defined
let missingWooVariables = [];
['WOO_URL', 'WOO_KEY', 'WOO_SECRET', 'WOO_HOOKS_SECRET'].forEach((env) => {
    if (!process.env[env]) missingWooVariables.push(env);
})
if (missingWooVariables.length === 1 || missingWooVariables === 2) throw new Error(`Missing environment variables: ${missingWooVariables.join(',')}`);


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