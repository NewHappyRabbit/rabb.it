import page from 'page';
import { salesPage } from './orders.js';
import { createEditOrderPage } from './createEdit.js';

export function salesRoutes(auth) {
    page('/orders', auth, salesPage);
    page('/orders/create', auth, createEditOrderPage);
    page('/orders/:id', auth, createEditOrderPage);
}