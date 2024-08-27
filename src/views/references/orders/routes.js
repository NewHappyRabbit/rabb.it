import page from 'page';
import { referencesOrdersPage } from '@/views/references/orders/references.orders.js';

export function referencesSalesRoutes(auth) {
    page('/references/orders', auth, referencesOrdersPage);
}