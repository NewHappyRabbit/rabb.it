import 'dotenv/config';
import express from 'express';
import { mongoConfig } from './config/database.js';
import { corsURLS, expressConfig } from './config/express.js';
import { loadRoutes } from './routes/routes.js';
import https from 'https';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import path from 'path';
import { Server } from "socket.io";
import { productSockets } from './routes/products.js';

export const app = express();

// Set base path for all routes
export const basePath = process.env.ENV == 'dev' ? '/' : '/server';

await mongoConfig();
expressConfig();
loadRoutes();


// Read SSL certificate and key files
var ssl;
var sslDir = path.join(dirname(fileURLToPath(import.meta.url)), 'ssl-certificates');

if (fs.existsSync(`${sslDir}/${process.env.ENV}-key.pem`) && fs.existsSync(`${sslDir}/${process.env.ENV}-cert.pem`)) {
    ssl = {
        key: fs.readFileSync(`${sslDir}/${process.env.ENV}-key.pem`),
        cert: fs.readFileSync(`${sslDir}/${process.env.ENV}-cert.pem`),
    };

    // For live, must include Certificate Authority file
    if (fs.existsSync(`${sslDir}/${process.env.ENV}-ca.pem`))
        ssl.ca = fs.readFileSync(`${sslDir}/${process.env.ENV}-ca.pem`);
} else throw new Error('No SSL certificate found!');

export const appURL = 'https://app.emo-sklad.bg'; // used for woocommerce url when getting product image to upload it
const httpPort = 3000;
const httpsPort = 8443;

const httpServer = http.createServer(app);
const httpsServer = https.createServer(ssl, app);

httpServer.listen(httpPort, () => {
    console.log(`Node HTTP listening on port ${httpPort}! Environment is: ${process.env.ENV}`);
});

httpsServer.listen(httpsPort, () => {
    console.log(`Node HTTPS listening on port ${httpsPort}! Environment is: ${process.env.ENV}`);
});

// Socket.io
const socketIoPath = process.env.ENV === 'dev' ? '/socket.io/' : '/server/socket.io/';
// Hosting NodeJS apps on SuperHosting uses Passenger. Passenger grabs the first server instance that starts a .listen() and uses it. It doesnt work on https for some reason.
export const io = new Server(process.env.ENV === 'dev' ? httpsServer : httpServer, {
    cors: {
        origin: corsURLS,
        credentials: true
    },
    transports: ['websocket', 'polling'],
    path: socketIoPath,
    allowEIO3: true,
});

/* io.engine.on("connection_error", (err) => {
    // console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
});*/

io.on('connection', (socket) => {
    socket.emit('connected', socket.id);

    productSockets(socket);
});