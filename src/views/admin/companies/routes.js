import page from 'page';
import { adminAuth } from '@/views/login';
import { companiesPage } from '@/views/admin/companies//companies';
import { createEditCompanyPage } from '@/views/admin/companies/createEdit';

export function companiesRoutes() {
    page('/admin/companies', adminAuth, companiesPage);
    page('/admin/companies/create', adminAuth, createEditCompanyPage);
    page('/admin/companies/:id', adminAuth, createEditCompanyPage);
}