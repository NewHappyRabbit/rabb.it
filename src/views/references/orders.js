import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatPrice } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { until } from "lit/directives/until.js";
import { spinner } from "@/views/components";
import page from 'page';
import { loggedInUser } from "@/views/login";

var pageCtx, path, params, pageCount, selectedFilters = {};
var temp;

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
    data.pageNumber = selectedFilters.pageNumber;

    if (data.customer) {
        var selectedId = document.querySelector(`datalist option[value='${data.customer}']`).getAttribute('_id');
        data.customer = selectedId;
    }

    if (data.company) {
        var selectedId2 = document.querySelector(`datalist option[value='${data.company}']`).getAttribute('_id');
        data.company = selectedId2;
    }

    if (data.user) {
        var selectedId3 = document.querySelector(`datalist option[value='${data.user}']`).getAttribute('_id');
        data.user = selectedId3;
    }

    if (data.product) {
        var selectedId4 = document.querySelector(`datalist option[value='${data.product}']`).getAttribute('_id');
        data.product = selectedId4;
    }

    selectedFilters = data;

    if (data.unpaid)
        selectedFilters.unpaid = true;

    if (e) // if coming from filters and not pagination
        delete selectedFilters.pageNumber;

    Object.keys(selectedFilters).forEach(key => selectedFilters[key] === '' && delete selectedFilters[key]);

    const uri = Object.keys(selectedFilters).map(key => `${key}=${selectedFilters[key]}`).join('&');

    if (uri.length)
        page('/references/orders?' + uri);
    else
        page('/references/orders');
}

const table = ({ orders, count, pageCount, total, print = false }) => html`
    <div class="mt-2 mb-2 d-print-none">Брой редове: ${count}</div>
    <div class="${print ? '' : 'table-responsive'}" style=${print && 'width: 100%; font-size: 0.6rem;'}>
        <table class="mt-3 table table-bordered table-striped table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Снимка</th>
                    <th class="d-print-none" scope="col">Тип</th>
                    <th class="d-print-none" scope="col">Номер</th>
                    <th class="d-print-none" scope="col">Партньор</th>
                    <th class="d-print-none" scope="col">Обект</th>
                    <th class="d-print-none" scope="col">Дата</th>
                    <th scope="col">Артикул</th>
                    <th scope="col">Доставна цена</th>
                    <th scope="col">Продажна цена</th>
                    <th scope="col">Пакети/Бройки</th>
                    <th class="d-print-none" scope="col">Повтарящи бр. от размер</th>
                    <th scope="col">Бройки в пакет/Размер</th>
                    <th class="d-print-none" scope="col">Отстъпка %</th>
                    <th scope="col">Сума доставна</th>
                    <th scope="col">Сума продажна</th>
                    <th class="d-print-none" scope="col">Начин на плащане</th>
                </tr>
            </thead>
            <tbody>
                ${orders?.map(order => html`
                    ${order.products.map(product => html`
                    <tr>
                        <td>${product?.product?.image?.url ? html`<img class="img-thumbnail w-100" src=${product.product.image.url}/>` : ''}</td>
                        <td class="d-print-none">${params.documentTypes[order.type]}</td>
                        <td class="d-print-none">${order.number}</td>
                        <td class="d-print-none">${order.customer.name}</td>
                        <td class="d-print-none">${order.company.name} (${(order.user?.username || 'Изтрит потребител')})</td>
                        <td class="d-print-none">${new Date(order.date).toLocaleDateString('bg')}</td>
                        <td>${product.product ? `${product.product.name} [${product.product.code}] ${product?.selectedSizes?.length ? '(' + product.selectedSizes.join(', ') + ')' : ''}` : product.name}</td>
                        <td>${product?.product?.deliveryPrice ? formatPrice(product?.product?.deliveryPrice) : ''}</td>
                        <td>${formatPrice(product.price)}</td>
                        <td>${product.quantity}</td>
                        <td class="d-print-none">${product?.multiplier || ''}</td>
                        <td>${product?.qtyInPackage || product?.selectedSizes?.length || ''}</td>
                        <td class="d-print-none">${product?.discount}</td>
                        <td>${product?.product?.deliveryPrice ? formatPrice((product.product.deliveryPrice * product.quantity) * (1 - product.discount / 100)) : ''}</td>
                        <td>${formatPrice((product.price * product.quantity) * (1 - product.discount / 100))}</td>
                        <td class="d-print-none" >${params.paymentTypes[order.paymentType]}</td>
                    </tr>
                    `)}
                `)}
                <tr class="fw-bold">
                    <td colspan="${print ? 4 : 9}"></td>
                    <td>Общо количество: ${total.quantity} бр.</td>
                    <td colspan="${print ? 0 : 3}"></td>
                    <td>Общо доставна цена: ${formatPrice(total.delivery)}</td>
                    <td>Общо продажна цена: ${formatPrice(total.price)}</td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="d-flex justify-content-center w-50 m-auto gap-3 mb-3 d-print-none">
        ${!selectedFilters.pageNumber || selectedFilters.pageNumber === 1 ? '' : html`<button class="btn btn-primary" value="prevPage" @click=${prevPage}><i class="bi bi-arrow-left"></i></button>`}
        ${pageCount < 2 ? '' : html`
            <div class="input-group w-25">
                <input @change=${goToPage} class="form-control" type="text" name="pageNumber" id="pageNumber" value=${selectedFilters.pageNumber || 1}>
                <span class="input-group-text">/${pageCount || 1}</span>
            </div>`}
        ${Number(selectedFilters.pageNumber) === pageCount || (!selectedFilters.pageNumber && pageCount < 2) ? '' : html`<button class="btn btn-primary" value="nextPage" @click=${nextPage}><i  class="bi bi-arrow-right"></i></button>`}
    </div>
`;

const filters = (customers, companies, users, products, params) => html`
        <form @change=${applyFilters} id="filters" class="row align-items-end w-100 g-3">
            <div class="col-6 col-sm">
                <label for="product">Продукт:</label>
                <input .value=${(temp = products.find(c => c._id === selectedFilters?.product)) ? `${temp.name} [${temp.code}]` : ''} list="productsList" placeholder="Име/код" name="product" id="product" class="form-control" autocomplete="off">
                <datalist id="productsList">
                    ${products.map(product => html`<option value=${`${product.name} [${product.code}]`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="customer">Партньор:</label>
                <input value=${(temp = customers.find(c => selectedFilters?.customer === c._id)) ? `${temp.name}${temp.vat ? ` [${temp.vat}]` : ''}${temp.phone ? ` (${temp.phone})` : ''}` : ''} list="customersList" placeholder="Всички" name="customer" id="customer" class="form-control" autocomplete="off">
                <datalist id="customersList">
                    ${customers && customers.map(customer => html`<option _id="${customer._id}" value=${`${customer.name}${customer.vat ? ` [${customer.vat}]` : ''}${customer.phone ? ` (${customer.phone})` : ''}`}></option>`)};
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="company">Издадена от фирма:</label>
                <input value=${(temp = companies.find(c => selectedFilters?.company === c._id)) ? `${temp.name} [${temp.vat}]` : ''} list="companiesList" placeholder="Всички" name="company" id="company" class="form-control" autocomplete="off">
                <datalist id="companiesList">
                    ${companies.map(company => html`<option _id="${company._id}" value=${`${company.name} [${company.vat}]`}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="user">Издадена от потребител:</label>
                <input .value=${(temp = users.find(u => selectedFilters?.user === u._id)) ? `${temp.username} [${temp._id}]` : ''} list="usersList" placeholder="Всички" name="user" id="user" class="form-control" autocomplete="off">
                <datalist id="usersList">
                    ${users.map(user => html`<option _id="${user._id}" value=${user.username}>`)}
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label class="form-label">Номер на документ</label>
                <div class="d-flex gap-1 align-items-center">
                    <input type="text" value=${selectedFilters?.numberFrom || ''} id="numberFrom" name="numberFrom" class="form-control" autocomplete="off"/>
                    <span>-</span>
                    <input type="text" value=${selectedFilters?.numberTo || ''} id="numberTo" name="numberTo" class="form-control" autocomplete="off"/>
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
                <input type="date" id="from" value=${selectedFilters?.from || ''} name="from" class="form-control">
            </div>
            <div class="col-6 col-sm">
                <label for="to">До:</label>
                <input type="date" id="to" value=${selectedFilters?.to || ''} name="to" class="form-control">
            </div>
        </form>
`;

function calculateTotals(orders) {
    const total = {
        quantity: 0,
        delivery: 0,
        price: 0,
    };

    for (const order of orders) {
        for (const product of order.products) {
            total.quantity += product.quantity;
            total.price += (product.price * product.quantity) * (1 - product.discount / 100);
            product?.product?.deliveryPrice && (total.delivery += (product.product.deliveryPrice * product.quantity) * (1 - product.discount / 100));
        }
    }

    return total;
}

async function print() {
    const printContainer = document.getElementById('printContainer');

    // Add print=true to querystring
    const currentURL = new URLSearchParams(pageCtx.querystring);
    currentURL.set('print', true);
    const newURL = currentURL.toString();

    // Get all references without pagination
    const req = await axios.get(pageCtx.pathname + '?' + newURL);
    const { orders } = req.data;
    const total = calculateTotals(orders);

    render(table({ orders, print: true, total }), printContainer);
    try {
        if (!document.execCommand('print', false, null)) {
            window.print();
        }
    } catch {
        window.print();
    }
}

async function loadReferences() {
    try {
        const [req, paramsReq, customersReq, companiesReq, usersReq, productsReq] = await Promise.all([
            axios.get(path),
            axios.get('/orders/params'),
            axios.get('/customers', { params: { page: 'references' } }),
            axios.get('/companies'),
            axios.get('/users'),
            axios.get('/products', { params: { page: 'references' } }),
        ]);
        const { orders, count, pageCount: pgCount } = req.data;
        pageCount = pgCount;
        params = paramsReq.data;
        const customers = customersReq.data.customers;
        const companies = companiesReq.data.companies;
        const users = usersReq.data;
        const products = productsReq.data.products;

        const total = calculateTotals(orders);

        return html`
        ${filters(customers, companies, users, products, params)}
        ${table({ orders, count, pageCount, total })}`
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