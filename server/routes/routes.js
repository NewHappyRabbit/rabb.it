import express from 'express';
import { app } from '../app.js';
import { categoriesRoutes } from './categories.js';
import { customersRoutes } from './customers.js';
import { productsRoutes } from './products.js';
import { usersRoutes } from "./users.js";
import { settingsRoutes } from './settings.js';
import { ordersRoutes } from './orders.js';
import { companiesRoutes } from './companies.js';
import { referencesSalesRoutes } from './references.js';
import { rateLimit } from 'express-rate-limit'
import { FirstInitWooCommerce } from '../woocommerce/init.js';
import { woocommerceRoutes } from './woocommerce.js';

const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // message: "Изпратихте прекалено много заявки към сървъра, моля опитайте отново по-късно."
});


export function loadRoutes() {
    // Apply the rate limiting middleware to all requests.
    // app.use(limiter);

    // Serve static files
    app.use(express.static('public'));

    // Load all routes
    usersRoutes();
    categoriesRoutes();
    customersRoutes();
    productsRoutes();
    categoriesRoutes();
    settingsRoutes();
    ordersRoutes();
    companiesRoutes();
    referencesSalesRoutes();
    woocommerceRoutes();

    //TODO Run this only the first time when the ecommerce is created to fill with data
    // FirstInitWooCommerce();

    // Set default 404 for all routes
    app.all('*', (req, res) => {
        res.status(404).send('404 Not Found');
    });
}