import page from 'page';
import { salesPage } from './orders.js';
import { createEditSalePage } from './createEdit.js';

export function salesRoutes(auth) {
    page('/orders', auth, salesPage);
    page('/orders/create', auth, createEditSalePage);
    page('/orders/:id', auth, createEditSalePage);
}