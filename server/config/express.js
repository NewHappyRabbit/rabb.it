import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { app } from '../app.js';
import { httpLogger } from './logger.js';

export const corsURLS = ['http://localhost:3003', 'https://localhost:3003', 'https://app.emo-sklad.bg', 'https://app.emo-sklad.bg/server'];
function expressConfig() {
    // Enable CORS
    // Origin is which domains can access the server (frontend)
    app.use(cors({ origin: corsURLS, credentials: true }));
    // Enable requests to have file-type/json
    app.use(express.json());
    app.use(cookieParser());
    app.use(httpLogger)
}

export { expressConfig }