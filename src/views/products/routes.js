import page from 'page';
import { productsPage } from '@/views/products/products';
import { createEditProductPage } from '@/views/products/createEdit';
import { restockPage } from '@/views/products/restock';
// FIXME DELETE THIS AFTER ALL PRODDUCTS ATTRIBUTES CREATED
import { tempPage } from '@/views/products/temp';

export function productsRoutes(auth) {
    page('/products', auth, productsPage);
    page('/products/create', auth, createEditProductPage);
    page('/products/restock', auth, restockPage);
    // FIXME DELETE THIS AFTER ALL PRODDUCTS ATTRIBUTES CREATED
    page('/products/temp', auth, tempPage);
    page('/products/:id', auth, createEditProductPage);
}