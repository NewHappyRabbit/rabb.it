import page from 'page';
import { productsPage } from '@/views/products/products';
import { createEditProductPage } from '@/views/products/createEdit';
import { restockPage } from '@/views/products/restock';

export function productsRoutes(auth) {
    page('/products', auth, productsPage);
    page('/products/create', auth, createEditProductPage);
    page('/products/restock', auth, restockPage);
    page('/products/:id', auth, createEditProductPage);
}