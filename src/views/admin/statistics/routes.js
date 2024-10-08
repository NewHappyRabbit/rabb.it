import page from 'page';
import { adminAuth } from '@/views/login';
import { statisticsPage } from './statistics.js';


export function statisticsRoutes() {
    page('/admin/statistics', adminAuth, statisticsPage);
}