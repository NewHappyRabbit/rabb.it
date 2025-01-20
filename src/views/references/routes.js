import page from 'page';
import { referencesOrdersPage } from '@/views/references/orders.js';
import { accountingReferencesPage } from '@/views/references/accounting.js';
import { stocksOrdersPage } from '@/views/references/stocks.js';

export function referencesSalesRoutes(auth) {
    page('/references/orders', auth, referencesOrdersPage);
    page('/references/accounting', auth, accountingReferencesPage);
    page('/references/stocks', auth, stocksOrdersPage);
}