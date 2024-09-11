import '@/css/orders.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatPrice } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { until } from "lit/directives/until.js";
import { spinner } from "@/views/components";
import page from 'page';
import { loggedInUser } from "@/views/login.js";

var selectedSale, pageCtx, path, params, selectedFilters = {};
var temp;

function switchPage(cursor) {
    const query = pageCtx.querystring;

    if (query.length === 0)
        page('/orders/?cursor=' + cursor);
    else if (query.includes('cursor')) {
        // replace cursor value in query
        const newQuery = query.split('&').map(q => q.includes('cursor') ? 'cursor=' + cursor : q).join('&');
        page('/orders/?' + newQuery);
    } else {
        // add cursor to query
        page('/orders/?' + query + '&cursor=' + cursor);
    }
}

const table = (orders, prevCursor, nextCursor) => html`
    <div class="table-responsive">
        <table class="mt-3 table table-striped table-hover text-center align-middle">
            <thead>
                <tr>
                    <th scope="col">Тип</th>
                    <th scope="col">Номер</th>
                    <th scope="col">Партньор</th>
                    <th scope="col">Обект</th>
                    <th scope="col">Дата</th>
                    <th scope="col">Стойност</th>
                    <th scope="col">Начин на плащане</th>
                    <th scope="col">Тип на продажба</th>
                    <th scope="col">Задължения</th>
                    <th scope="col">Действия</th>
                </tr>
            </thead>
            <tbody>
                ${orders?.map(order => html`
                    <tr class="${order.unpaid === true ? "table-danger" : ""}">
                        <td class="text-start">${params.documentTypes[order.type]}${order?.woocommerce ? html`<i class="bi bi-globe text-primary ms-2 fs-5"></i>` : ''}</td>
                        <td>${order.number}</td>
                        <td>${order.customer.name}</td>
                        <td>${order.company.name}</td>
                        <td>${new Date(order.date).toLocaleDateString('bg')}</td>
                        <td>${formatPrice(order.total)}</td>
                        <td>${params.paymentTypes[order.paymentType]}</td>
                        <td>${params.orderTypes[order.orderType]}</td>
                        <td>${order.unpaid === true ? formatPrice(order.total - order.paidAmount) : ""}</td>
                        <td>
                            <a href="/orders/${order._id}" class="btn btn-primary"><i class="bi bi-pencil"></i> ${['manager', 'admin'].includes(loggedInUser.role) ? 'Редактирай' : 'Преглед'}</a>
                            ${loggedInUser.role === 'admin' ? html`<button @click=${() => selectedSale = order._id} class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#cancelModal"><i class="bi bi-trash"></i> Анулирай</button>` : ''}
                        </td>
                    </tr>
                `)}
            </tbody>
        </table>
    </div>
    <div class="d-flex justify-content-center">
        ${prevCursor ? html`<button @click=${() => switchPage(prevCursor)} class="btn btn-primary"><i class="bi bi-arrow-left"></i> Предишна страница</button>` : ''}
        ${nextCursor ? html`<button @click=${() => switchPage(nextCursor)} class="btn btn-primary">Следваща страница <i class="bi bi-arrow-right"></i></button>` : ''}
    </div>
`;

async function applyFilters(e) {
    e.preventDefault();

    const formData = new FormData(document.getElementById('filters'));
    const data = Object.fromEntries(formData.entries());

    if (data.customer)
        data.customer = data.customer.split('[')[1].split(']')[0];

    if (data.company)
        data.company = data.company.split('[')[1].split(']')[0];

    if (data.unpaid)
        data.unpaid = true;

    // remove empty fields
    Object.keys(data).forEach(key => data[key] === '' && delete data[key]);

    if (data.length === 0)
        page('/orders')
    else if (data.length === 1)
        page(`/orders?${Object.keys(data)[0]}=${Object.values(data)[0]}`);
    else {
        const uri = Object.keys(data).map(key => `${key}=${data[key]}`).join('&');
        page(`/orders?${uri}`);
    }
}

// TODO Add filter for only woocommerce or only app orderes
const filters = (customers, companies, params) => html`
        <form @change=${applyFilters} id="filters" class="row align-items-end w-100 g-3">
            <div class="col-6 col-sm">
                <label for="customer">Партньор:</label>
                <input .value=${(temp = customers.filter(c => c.vat === selectedFilters?.customer)[0]) ? `${temp.name} [${temp.vat}] ${temp.phone ? `(${temp.phone})` : ''}` : ''} list="customersList" placeholder="Всички" name="customer" id="customer" class="form-control" autocomplete="off">
                <datalist id="customersList">
                    ${customers.map(customer => html`<option value=${`${customer.name} [${customer.vat}] ${customer.phone ? `(${customer.phone})` : ''}`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="company">Обект:</label>
                <input .value=${(temp = companies.filter(c => c.vat === selectedFilters?.company)[0]) ? `${temp.name} [${temp.vat}]` : ''} list="companiesList" placeholder="Всички" name="company" id="company" class="form-control" autocomplete="off">
                <datalist id="companiesList">
                    ${companies.map(company => html`<option value=${`${company.name} [${company.vat}]`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="number" class="form-label">Номер на документ</label>
                <input type="text" .value=${selectedFilters?.number || ''} id="number" name="number" class="form-control" autocomplete="off"/>
            </div>
            <div class="col-6 col-sm">
                <label for="type" class="form-label">Тип на документ:</label>
                <select id="type" name="type" class="form-control">
                    <option value="" selected>Всички</option>
                    ${Object.entries(params.documentTypes).map(type => html`<option ?selected=${selectedFilters?.type === type[0]} value=${type[0]}>${type[1]}</option>`)}
                </select>
            </div>
            <div class="col-6 col-sm">
                <label for="paymentType" class="form-label">Начин на плащане</label>
                <select id="paymentType" name="paymentType" class="form-control">
                    <option value="" selected>Всички</option>
                    ${Object.entries(params.paymentTypes).map(type => html`<option ?selected=${selectedFilters?.paymentType === type[0]} value=${type[0]}>${type[1]}</option>`)}
                </select>
            </div>
            <div class="col-6 col-sm">
                <label for="orderType">Тип на продажба</label>
                <select id="orderType" name="orderType" class="form-control">
                    <option value="" selected>Всички</option>
                    ${Object.entries(params.orderTypes).map(type => html`<option ?selected=${selectedFilters?.orderType === type[0]} value=${type[0]}>${type[1]}</option>`)}
                </select>
            </div>
            <div class="col-6 col-sm">
                <label for="from">От:</label>
                <input type="date" id="from" .value=${selectedFilters?.from || ''} name="from" class="form-control">
            </div>
            <div class="col-6 col-sm">
                <label for="to">До:</label>
                <input type="date" id="to" .value=${selectedFilters?.to || ''} name="to" class="form-control">
            </div>
            <div class="col-12 col-sm">
                <div class="form-check form-switch p-0">
                    <label class="form-check-label d-block" for="unpaid">Само неплатени:</label>
                    <input class="form-check-input ms-0 fs-4" type="checkbox" role="switch" id="unpaid" ?checked=${selectedFilters?.unpaid} name="unpaid">
                </div>
            </div>
        </form>
`;

async function loadSales() {
    try {
        const req = await axios.get(path)
        const orders = req.data.orders;
        const prevCursor = req.data.prevCursor;
        const nextCursor = req.data.nextCursor;


        params = (await axios.get('/orders/params')).data;
        const customers = (await axios.get('/customers', { params: { page: 'orders' } })).data.customers;
        const companies = (await axios.get('/companies')).data;

        return html`
        ${filters(customers, companies, params)}
        ${table(orders, prevCursor, nextCursor)}`
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

async function deleteSale() {
    try {
        const req = await axios.delete(`/orders/${selectedSale}`);

        if (req.status === 204) {
            page('/orders');
        }
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

export function salesPage(ctx, next) {
    path = ctx.path;
    pageCtx = ctx;
    temp = undefined;

    // check if filters are applied
    if (ctx.querystring)
        selectedFilters = Object.fromEntries(new URLSearchParams(ctx.querystring));
    else
        selectedFilters = {};

    const cancelModal = () => html`
    <div class="modal fade" id = "cancelModal" tabindex="-1" aria-labelledby="cancelModalLabel" aria-hidden="true" >
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="cancelModalLabel">Анулирай продажба</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    Сигурни ли сте че искате да анулирате продажбата? Това ще върне всички продукти в склада.
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Откажи</button>
                    <button @click=${deleteSale} type="button" class="btn btn-danger" data-bs-dismiss="modal">Анулирай</button>
                </div>
            </div>
        </div>
    </div>`;

    const template = () => html`
        ${cancelModal()}
        ${nav()}
        <div class="container-fluid">
            <a href='/orders/create' class="btn btn-primary"><i class="bi bi-plus"></i> Създай продажба</a>
            ${until(loadSales(), spinner)}
        </div>
    `;

    render(template(), container);
}