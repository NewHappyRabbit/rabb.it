import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { app } from '../app.js';
import { httpLogger } from './logger.js';

export const corsURLS = [
    // Nginx
    'http://localhost', 'https://localhost',

    // VSCODE Live Server extension
    'http://localhost:3003', 'https://localhost:3003',

    // Public domain
    process.env.URL, `${process.env.URL}/server`,
    // For hooks
    process.env.WOO_URL,
];

function expressConfig() {
    // Enable CORS
    // Origin is which domains can access the server (frontend)
    app.use(cors({ origin: corsURLS, credentials: true }));
    // Enable requests to have file-type/json
    app.use(
        express.json({
            verify: function (req, res, buf) {
                req.rawBody = buf;
            },
        })
    );
    app.use(cookieParser());
    app.use(httpLogger);
}

export { expressConfig }