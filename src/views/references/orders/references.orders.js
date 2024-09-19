import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatPrice } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { until } from "lit/directives/until.js";
import { spinner } from "@/views/components";
import page from 'page';
import { loggedInUser } from "@/views/login";

var pageCtx, path, params, selectedFilters = {};
var temp;

function switchPage(cursor) {
    const query = pageCtx.querystring;

    if (query.length === 0)
        page('/references/orders/?cursor=' + cursor);
    else if (query.includes('cursor')) {
        // replace cursor value in query
        const newQuery = query.split('&').map(q => q.includes('cursor') ? 'cursor=' + cursor : q).join('&');
        page('/references/orders/?' + newQuery);
    } else
        page('/references/orders/?' + query + '&cursor=' + cursor); // add cursor to query
}

// TODO Remove certain columns when print = true
const table = ({ print = false, orders, prevCursor, nextCursor }) => html`
    <table class="mt-3 table table-bordered table-striped table-hover text-center">
        <thead>
            <tr>
                <th scope="col">Снимка</th>
                <th scope="col">Тип</th>
                <th scope="col">Номер</th>
                <th scope="col">Партньор</th>
                <th scope="col">Обект</th>
                <th scope="col">Потребител</th>
                <th scope="col">Дата</th>
                <th scope="col">Артикул</th>
                <th scope="col">Цена</th>
                <th scope="col">Пакети/Бройки</th>
                <th scope="col">Бройки в пакет/Размер</th>
                <th scope="col">Отстъпка %</th>
                <th scope="col">Сума</th>
                <th scope="col">Начин на плащане</th>
                <th scope="col">Тип на продажба</th>
            </tr>
        </thead>
        <tbody>
            ${orders?.map(order => html`
                ${order.products.map(product => html`
                <tr>
                    <td>${product?.product?.image?.url ? html`<img class="img-thumbnail" src=${product.product.image.url}/>` : ''}</td>
                    <td>${params.documentTypes[order.type]}</td>
                    <td>${order.number}</td>
                    <td>${order.customer.name}</td>
                    <td>${order.company.name}</td>
                    <td>${order.user.username}</td>
                    <td>${new Date(order.date).toLocaleDateString('bg')}</td>
                    <td>${product.product ? `${product.product.name} [${product.product.code}]` : product.name}</td>
                    <td>${formatPrice(product.price)}</td>
                    <td>${product.quantity}</td>
                    <td>${product?.qtyInPackage || product?.selectedSizes?.length || ''}</td>
                    <td>${product?.discount}</td>
                    <td>${formatPrice((product.price * product.quantity) * (1 - product.discount / 100))}</td>
                    <td>${params.paymentTypes[order.paymentType]}</td>
                    <td>${params.orderTypes[order.orderType]}</td>
                </tr>
                `)}
            `)}
        </tbody>
    </table>
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

    if (data.user)
        data.user = data.user.split('[')[1].split(']')[0];

    if (data.product)
        data.product = data.product.split('[')[1].split(']')[0];

    // remove empty fields
    Object.keys(data).forEach(key => data[key] === '' && delete data[key]);

    if (data.length === 0)
        page('/references/orders')
    else if (data.length === 1)
        page(`/references/orders?${Object.keys(data)[0]}=${Object.values(data)[0]}`);
    else {
        const uri = Object.keys(data).map(key => `${key}=${data[key]}`).join('&');
        page(`/references/orders?${uri}`);
    }
}

const filters = (customers, companies, users, products, params) => html`
        <form @change=${applyFilters} id="filters" class="row align-items-end w-100 g-3">
            <div class="col-6 col-sm">
                <label for="product">Продукт:</label>
                <input .value=${(temp = products.filter(c => c.code === selectedFilters?.product)[0]) ? `${temp.name} [${temp.code}]` : ''} list="productsList" placeholder="Име/код" name="product" id="product" class="form-control" autocomplete="off">
                <datalist id="productsList">
                    ${products.map(product => html`<option value=${`${product.name} [${product.code}]`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="customer">Партньор:</label>
                <input .value=${(temp = customers.filter(c => c.vat === selectedFilters?.customer)[0]) ? `${temp.name} [${temp.vat}]` : ''} list="customersList" placeholder="Всички" name="customer" id="customer" class="form-control" autocomplete="off">
                <datalist id="customersList">
                    ${customers.map(customer => html`<option value=${`${customer.name} [${customer.vat}]`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="company">Издадена от фирма:</label>
                <input .value=${(temp = companies.filter(c => c.vat === selectedFilters?.company)[0]) ? `${temp.name} [${temp.vat}]` : ''} list="companiesList" placeholder="Всички" name="company" id="company" class="form-control" autocomplete="off">
                <datalist id="companiesList">
                    ${companies.map(company => html`<option value=${`${company.name} [${company.vat}]`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="user">Издадена от потребител:</label>
                <input .value=${(temp = users.filter(c => c._id === selectedFilters?.user)[0]) ? `${temp.username} [${temp._id}]` : ''} list="usersList" placeholder="Всички" name="user" id="user" class="form-control" autocomplete="off">
                <datalist id="usersList">
                    ${users.map(user => html`<option value=${`${user.username} [${user._id}]`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label class="form-label">Номер на документ</label>
                <div class="d-flex gap-1 align-items-center">
                    <input type="text" .value=${selectedFilters?.numberFrom || ''} id="numberFrom" name="numberFrom" class="form-control" autocomplete="off"/>
                    <span>-</span>
                    <input type="text" .value=${selectedFilters?.numberTo || ''} id="numberTo" name="numberTo" class="form-control" autocomplete="off"/>
                </div>
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
        </form>
`;

async function print() {
    const printContainer = document.getElementById('printContainer');

    // Add print=true to querystring
    const currentURL = new URLSearchParams(pageCtx.querystring);
    currentURL.set('print', true);
    const newURL = currentURL.toString();

    // Get all references without pagination
    const req = await axios.get(pageCtx.pathname + '?' + newURL);
    const { orders } = req.data;
    render(table({ orders, print: true }), printContainer);
    window.print();
}

async function loadReferences() {
    try {
        const req = await axios.get(path)
        const orders = req.data.orders;
        const prevCursor = req.data.prevCursor;
        const nextCursor = req.data.nextCursor;

        //TODO When all controlers done, do a one route to get all params
        params = (await axios.get('/orders/params')).data;
        const customers = (await axios.get('/customers', { params: { page: 'references' } })).data.customers;
        const companies = (await axios.get('/companies')).data.companies;
        const users = (await axios.get('/users')).data;
        const products = (await axios.get('/products', { params: { page: 'references' } })).data.products;

        return html`
        ${filters(customers, companies, users, products, params)}
        ${table({ orders, prevCursor, nextCursor })}`
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

export function referencesOrdersPage(ctx, next) {
    if (loggedInUser.role !== 'admin')
        return page('/');

    path = ctx.path;
    pageCtx = ctx;
    temp = undefined;

    // check if filters are applied
    //TODO Use this way to get params from filters everywhere
    if (ctx.querystring)
        selectedFilters = Object.fromEntries(new URLSearchParams(ctx.querystring));
    else
        selectedFilters = {};

    const template = () => html`
        ${nav()}
        <div class="container-fluid d-print-none">
            <button @click=${print} class="btn btn-primary">Принтирай</button>
            <div id="references" class="table-responsive">
                ${until(loadReferences(), spinner)}
            </div>
        </div>
        <div id="printContainer" class="d-none d-print-block"></div>
    `;

    render(template(), container);
}