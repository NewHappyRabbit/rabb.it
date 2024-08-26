import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { addQuery, delay, removeQuery } from "@/api";
import page from 'page';
import { nav } from '../nav.js';
import { until } from "lit/directives/until.js";
import { spinner } from "../components.js";
import { loggedInUser } from "../login.js";


var selectedCustomer, path, pageCtx;

async function deleteCustomer() {
    try {
        const req = await axios.delete(`/customers/${selectedCustomer}`);

        if (req.status === 204) {
            page(path);
        }
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

async function unhideCustomer(_id) {
    try {
        const req = await axios.put(`/customers/${_id}/unhide`);

        if (req.status === 201)
            page(path);

    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

const quickViewRow = (name, value) => html`
    <div class="row col-6 mb-2">
        <b class="d-block">${name}:</b>
        <span>${value}</span>
    </div>`;

const quickViewTemplate = (customer) => html`
<div class="row g-3">
    ${quickViewRow('Фирма', customer.name)}
    ${quickViewRow('МОЛ', customer.mol)}
    ${quickViewRow('ЕИК', customer.vat)}
    ${quickViewRow('ДДС ЕИК', customer.taxvat)}
    ${quickViewRow('Отстъпка', customer.discount ? `${customer.discount}%` : 'Няма')}
    ${quickViewRow('Телефон', customer.phone ? customer.phone : 'Няма')}
    ${quickViewRow('Имейл', customer.email ? customer.email : 'Няма')}
    ${quickViewRow('Адрес', customer.address)}
    ${quickViewRow('Адрес за доставка', customer.deliveryAddress ? customer.deliveryAddress : 'Няма')}
    ${quickViewRow('Скрит', customer.deleted ? 'Да' : 'Не')}
</div>
`;

async function loadQuickView(_id) {
    if (!_id) return;
    try {
        const req = await axios.get(`/customers/${_id}`);
        const customer = req.data;
        const modal = document.querySelector('#quickViewModal .modal-body');



        render(quickViewTemplate(customer), modal);
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

const customerRow = (customer) => html`
    <tr .id=${customer._id}>
        <td>${customer.name}</td>
        <td>${customer.vat}</td>
        <td>${customer.phone}</td>
        <td>${customer.discount}</td>
        <td class="text-nowrap">
            <button data-bs-toggle="modal" data-bs-target="#quickViewModal" class="btn btn-primary" @click=${() => loadQuickView(customer._id)}><i class="bi bi-eye"></i><span class="d-none d-sm-inline"> Преглед</span></button>
            ${['manager', 'admin'].includes(loggedInUser.role) ? html`<a class="btn btn-secondary" href=${`/customers/${customer._id}`}><i class="bi bi-pencil"></i><span class="d-none d-sm-inline"> Редактирай</span></a>` : ''}
            ${loggedInUser.role === 'admin' ? (customer.deleted ?
        html`<button @click=${() => unhideCustomer(customer._id)} class="btn btn-success"><i class="bi bi-arrow-clockwise"></i><span class="d-none d-sm-inline"> Възстанови</span></button>` : html`<button @click=${() => selectedCustomer = customer._id} class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#deleteModal"><i class="bi bi-trash"></i><span class="d-none d-sm-inline"> Изтрий</span></button>`) : ''}
        </td>
    </tr>
`;

const table = (customers, prevCursor, nextCursor) => html`
    <div class="table-responsive">
        <table class="mt-3 table table-striped table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Фирма</th>
                    <th scope="col">ЕИК</th>
                    <th scope="col">Телефон</th>
                    <th scope="col">Отстъпка %</th>
                    <th scope="col">Действия</th>
                </tr>
            </thead>
            <tbody>
                ${customers ? customers.map(customerRow) : html`<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>`}
            </tbody>
        </table>
    </div>
    <div class="d-flex justify-content-center">
        ${prevCursor ? html`<button @click=${() => switchPage(prevCursor)} class="btn btn-primary"><i class="bi bi-arrow-left"></i> Предишна страница</button>` : ''}
        ${nextCursor ? html`<button @click=${() => switchPage(nextCursor)} class="btn btn-primary">Следваща страница <i class="bi bi-arrow-right"></i></button>` : ''}
    </div>
`;

function switchPage(cursor) {
    var uri;

    uri = addQuery(pageCtx, 'cursor', cursor);

    page(uri);
}

async function loadCustomers() {
    try {
        const req = await axios.get(path)
        const customers = req.data.customers;
        const prevCursor = req.data.prevCursor;
        const nextCursor = req.data.nextCursor;

        return table(customers, prevCursor, nextCursor);
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

export async function customersPage(ctx, next) {
    path = ctx.path;
    pageCtx = ctx;

    function findCustomer(e) {
        const search = e.target.value;
        const lastSearch = ctx.querystring.split('search=')[1]?.split('&')[0];

        if (lastSearch === search) // Skip
            return;

        var uri;
        if (search.length == 0) // Remove from query
            uri = removeQuery(ctx, 'search');
        else
            uri = addQuery(ctx, 'search', search);

        page(uri);
    }

    function toggleDeleted(e) {
        const showDeleted = e.target.checked;
        var uri;

        if (showDeleted)
            uri = addQuery(ctx, 'showDeleted', true);
        else
            uri = removeQuery(ctx, 'showDeleted');

        page(uri);
    }

    const quickViewModal = () => html`
    <div class="modal fade" id="quickViewModal" tabindex="-1" aria-labelledby="quickViewModalLabel" aria-hidden="true" >
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="quickViewModalLabel">Бърз преглед</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                </div>
            </div>
        </div>
    </div>`;

    const deleteModal = () => html`
    <div class="modal fade" id = "deleteModal" tabindex="-1" aria-labelledby="deleteModalLabel" aria-hidden="true" >
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="deleteModalLabel">Изтрий клиент</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    Ако клиентът има документи обвързани с него, той ще бъде само скрит. Сигурни ли сте че изкате да изтриете този клиент? Това действие не може да бъде отменено.
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Откажи</button>
                    <button @click=${deleteCustomer} type="button" class="btn btn-danger" data-bs-dismiss="modal">Изтрий</button>
                </div>
            </div>
        </div>
    </div>`;

    const filters = () => html`
        <div class="col-9 col-sm">
            <label for="customer">Клиент:</label>
            <input @keyup=${delay(findCustomer, 300)} list="customersList" placeholder="Въведи име, булстат или телефон" id="customer" class="form-control" autocomplete="off">
        </div>
        <div class="col-3 col-sm">
            <div class="form-check form-switch p-0">
                <label class="form-check-label d-block" for="showHidden">Покажи изтрити:</label>
                <input @change=${toggleDeleted} class="form-check-input ms-0 fs-4 pe-cursor" type="checkbox" role="switch" name="showDeleted" id="showDeleted">
            </div>
        </div>
    `;

    const template = () => html`
        ${deleteModal()}
        ${quickViewModal()}
        ${nav()}
        <div class="container-fluid">
            <a href='/customers/create' class="btn btn-primary"><i class="bi bi-plus"></i> Създай партньор</a>
            <div id="filters" class="row align-items-end w-100">
                ${filters()}
            </div>
            ${until(loadCustomers(), spinner)}
        </div>
    `;

    render(template(), container);
}