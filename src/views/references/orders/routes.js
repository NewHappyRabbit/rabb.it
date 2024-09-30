import page from 'page';
import { referencesOrdersPage } from '@/views/references/orders/references.orders.js';
import { accountingReferencesPage } from '../accounting/references.accounting.js';

export function referencesSalesRoutes(auth) {
    page('/references/orders', auth, referencesOrdersPage);
    page('/references/accounting', auth, accountingReferencesPage);
}