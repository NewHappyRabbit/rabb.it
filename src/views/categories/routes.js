import page from 'page';
import { categoriesPage } from '@/views/categories/categories';

export function categoriesRoutes(auth) {
    page('/categories', auth, categoriesPage);
}