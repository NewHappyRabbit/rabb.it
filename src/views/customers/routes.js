import page from 'page';
import { customersPage } from '@/views/customers/customers';
import { createEditCustomerPage } from '@/views/customers/createEdit';

export function customersRoutes(auth) {
    page('/customers', auth, customersPage);
    page('/customers/create', auth, createEditCustomerPage);
    page('/customers/:id', auth, createEditCustomerPage);
}