import page from 'page';
import { POSpage } from './pos';

export function referencesSalesRoutes(auth) {
    page('/pos', auth, POSpage);
}