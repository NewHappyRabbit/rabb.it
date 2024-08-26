import page from 'page';
import { salesPage } from './sales.js';
import { createEditSalePage } from './createEdit.js';

export function salesRoutes(auth) {
    page('/sales', auth, salesPage);
    page('/sales/create', auth, createEditSalePage);
    page('/sales/:id', auth, createEditSalePage);
}