import page from 'page';
import { referencesSalesPage } from '@/views/references/sales/references.sales.js';

export function referencesSalesRoutes(auth) {
    page('/references/sales', auth, referencesSalesPage);
}