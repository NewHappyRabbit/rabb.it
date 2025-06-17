import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { delay } from "@/api";
import page from 'page';
import { nav } from '../nav.js';
import { until } from "lit/directives/until.js";
import { spinner } from "../components.js";
import { loggedInUser } from "../login.js";


var selectedCustomer, path, selectedFilters = {}, pageCount;

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
        <td>${customer.address}</td>
        <td>${customer.discount}</td>
        <td class="text-nowrap">
            <button data-bs-toggle="modal" data-bs-target="#quickViewModal" class="btn btn-primary" @click=${() => loadQuickView(customer._id)}><i class="bi bi-eye"></i><span class="d-none d-sm-inline"> Преглед</span></button>
            ${['manager', 'admin'].includes(loggedInUser.role) ? html`<a class="btn btn-secondary" href=${`/customers/${customer._id}`}><i class="bi bi-pencil"></i><span class="d-none d-sm-inline"> Редактирай</span></a>` : ''}
            ${loggedInUser.role === 'admin' ? (customer.deleted ?
        html`<button @click=${() => unhideCustomer(customer._id)} class="btn btn-success"><i class="bi bi-arrow-clockwise"></i><span class="d-none d-sm-inline"> Възстанови</span></button>` : html`<button @click=${() => selectedCustomer = customer._id} class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#deleteModal"><i class="bi bi-trash"></i><span class="d-none d-sm-inline"> Изтрий</span></button>`) : ''}
        </td>
    </tr>
`;

const table = (customers, count) => html`
    <div class="mt-2 mb-2">Брой клиенти: ${count}</div>
    <div class="table-responsive">
        <table class="mt-3 table table-striped table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Фирма</th>
                    <th scope="col">ЕИК</th>
                    <th scope="col">Телефон</th>
                    <th scope="col">Адрес</th>
                    <th scope="col">Отстъпка %</th>
                    <th scope="col">Действия</th>
                </tr>
            </thead>
            <tbody>
                ${customers ? customers.map(customerRow) : html`<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>`}
            </tbody>
        </table>
    </div>
    <div class="d-flex justify-content-center w-50 m-auto gap-3 mb-3">
        ${!selectedFilters.pageNumber || selectedFilters.pageNumber === 1 ? '' : html`<button class="btn btn-primary" value="prevPage" @click=${prevPage}><i class="bi bi-arrow-left"></i></button>`}
        ${pageCount < 2 ? '' : html`
            <div class="input-group w-25">
                <input @change=${goToPage} class="form-control" type="text" name="pageNumber" id="pageNumber" value=${selectedFilters.pageNumber || 1}>
                <span class="input-group-text">/${pageCount || 1}</span>
            </div>`}
        ${Number(selectedFilters.pageNumber) === pageCount || (!selectedFilters.pageNumber && pageCount < 2) ? '' : html`<button class="btn btn-primary" value="nextPage" @click=${nextPage}><i  class="bi bi-arrow-right"></i></button>`}
    </div>
`;

async function loadCustomers() {
    try {
        const req = await axios.get(path)
        const { customers, count, pageCount: pgCount } = req.data;

        pageCount = pgCount;
        return table(customers, count);
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

function goToPage(e) {
    const pageNumber = Number(e.target.value);

    if (!pageNumber || pageNumber < 1) selectedFilters.pageNumber = 1;
    else if (pageNumber > pageCount) selectedFilters.pageNumber = pageCount;
    else selectedFilters.pageNumber = pageNumber;

    applyFilters();
}

function prevPage() {
    if (!selectedFilters.pageNumber || selectedFilters.pageNumber === 1) return;
    else selectedFilters.pageNumber = selectedFilters.pageNumber - 1;
    applyFilters();
}

function nextPage() {
    if (Number(selectedFilters.pageNumber) === pageCount || (!selectedFilters.pageNumber && pageCount < 2)) return;
    else if (!selectedFilters.pageNumber && pageCount > 1) selectedFilters.pageNumber = 2;
    else selectedFilters.pageNumber = Number(selectedFilters.pageNumber) + 1;
    applyFilters();
}

async function applyFilters(e) {
    const formData = new FormData(document.getElementById('filters'));
    const data = Object.fromEntries(formData.entries());

    selectedFilters.search = data.search;

    if (data.showDeleted)
        selectedFilters.showDeleted = true;
    else selectedFilters.showDeleted = ''


    if (e) // if coming from filters and not pagination
        delete selectedFilters.pageNumber;

    Object.keys(selectedFilters).forEach(key => selectedFilters[key] === '' && delete selectedFilters[key]);

    page(getUrl());
}

function getUrl() {
    const uri = Object.keys(selectedFilters).map(key => `${key}=${selectedFilters[key]}`).join('&');

    if (uri.length)
        return `/customers?${uri}`;
    return '/customers';
}

export async function customersPage(ctx, next) {
    path = ctx.path;

    // check if filters are applied
    if (ctx.querystring)
        selectedFilters = Object.fromEntries(new URLSearchParams(ctx.querystring));
    else
        selectedFilters = {};

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
            <label for="search">Клиент:</label>
            <input @keyup=${delay(applyFilters, 300)} list="customersList" placeholder="Въведи име, булстат или телефон" id="search" name="search" value=${selectedFilters?.search} class="form-control" autocomplete="off">
        </div>
        <div class="col-3 col-sm">
            <div class="form-check form-switch p-0">
                <label class="form-check-label d-block" for="showHidden">Покажи изтрити:</label>
                <input @change=${applyFilters} ?checked=${selectedFilters?.showDeleted} class="form-check-input ms-0 fs-4 pe-cursor" type="checkbox" role="switch" name="showDeleted" id="showDeleted">
            </div>
        </div>
    `;

    const template = () => html`
        ${deleteModal()}
        ${quickViewModal()}
        ${nav()}
        <div class="container-fluid">
            <a href='/customers/create' class="btn btn-primary"><i class="bi bi-plus"></i> Създай партньор</a>
            <form id="filters" class="row align-items-end w-100">
                ${filters()}
            </form>
            ${until(loadCustomers(), spinner)}
        </div>
    `;

    render(template(), container);
}