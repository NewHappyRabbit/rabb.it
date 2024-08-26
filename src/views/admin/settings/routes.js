import page from 'page';
import { adminAuth } from '@/views/login';
import { settingsPage } from '@/views/admin/settings/settings';


export function settingsRoutes() {
    page('/admin/settings', adminAuth, settingsPage);
}