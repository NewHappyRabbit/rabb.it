import page from 'page';
import { usersPage } from '@/views/admin/users/users';
import { createEditUserPage } from '@/views/admin/users/createEdit';
import { adminAuth } from '@/views/login';


export function usersRoutes() {
    page('/admin/users', adminAuth, usersPage);
    page('/admin/users/create', adminAuth, createEditUserPage);
    page('/admin/users/:id', adminAuth, createEditUserPage);
}