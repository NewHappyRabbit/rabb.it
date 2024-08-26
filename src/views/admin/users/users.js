import { container } from "@/app.js";
import '@/css/categories.css';
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from '@/views/nav.js';
import { until } from 'lit/directives/until.js';
import page from 'page';
import { loggedInUser } from "@/views/login.js";
import { spinner } from "@/views/components";


async function deleteUser(_id) {
    if (_id === loggedInUser.id)
        return alert('Не може да изтриете собствения си акаунт');

    try {
        await axios.delete(`/users/${_id}`);
        page();
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

const table = (users) => html`
    <table class="table table-striped table-hover">
        <thead>
            <tr>
                <th>Потребителско име</th>
                <th>Роля</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody>
            ${users.map(user => html`
                <tr>
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td class="text-nowrap">
                        <a href="/admin/users/${user._id}" class="btn btn-primary"><i class="bi bi-pencil"></i><span class="d-none d-sm-inline"> Редактирай</span></a>
                        <button @click=${() => deleteUser(user._id)} class="btn btn-danger"><i class="bi bi-trash"></i><span class="d-none d-sm-inline"> Изтрий</span></button>
                    </td>
                </tr>
            `)}
        </tbody>
    </table>
`;

async function loadUsers() {
    const req = await axios.get('/users');

    return table(req.data);
}

export function usersPage() {
    if (loggedInUser && loggedInUser.role !== 'admin')
        return page('/');

    render(html`
        ${nav()}
        <div class="container-fluid">
            <a href='/admin/users/create' class="btn btn-primary"><i class="bi bi-plus"></i> Създай потребител</a>
            ${until(loadUsers(), spinner)}
        </div>
    `, container);
}