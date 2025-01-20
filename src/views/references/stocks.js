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

const table = ({ products, count, pageCount, total, print = false }) => html`
    <div class="mt-2 mb-2 d-print-none">Брой редове: ${count}</div>
    <div class="${print ? '' : 'table-responsive'}" style=${print && 'width: 100%; font-size: 0.6rem;'}>
        <table class="mt-3 table table-bordered table-striped table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Снимка</th>
                    <th scope="col">Артикул</th>
                    <th scope="col">Доставна цена</th>
                    <th scope="col">Цена едро</th>
                    <th scope="col">Цена дребно</th>
                    <th scope="col">Цели пакети/Бройки</th>
                    <th scope="col">Общ брой от пакети</th>
                    <th scope="col">Сума доставна</th>
                    <th scope="col">Сума едро</th>
                    <th scope="col">Сума дребно</th>
                </tr>
            </thead>
            <tbody>
                ${products?.map(product => html`
                    <tr>
                        <td>${product?.image?.url ? html`<img class="img-thumbnail w-100" src=${product.image.url}/>` : ''}</td>
                        <td>${`${product.name} [${product.code}] ${product?.selectedSizes?.length ? '(' + product.selectedSizes.join(', ') + ')' : ''}`}</td>
                        <td>${formatPrice(product.deliveryPrice)}</td>
                        <td>${formatPrice(product.wholesalePrice)}</td>
                        <td>${formatPrice(product.retailPrice)}</td>
                        <td>${product.quantity}</td>
                        <td>${product.sizes?.length && product.sizes.reduce((acc, size) => acc + size.quantity, 0)}</td>
                        <td>${formatPrice(product.deliveryPrice * product.quantity)}</td>
                        <td>${formatPrice(product.wholesalePrice * product.quantity)}</td>
                        <td>${formatPrice(product.retailPrice * (product.sizes.length ? product.sizes.reduce((acc, size) => acc + size.quantity, 0) : product.quantity))}</td>
                    </tr>
                `)}
                <tr class="fw-bold">
                    <td colspan="5"></td>
                    <td>Общо цели пакети/бройки: ${total.quantity} бр.</td>
                    <td>Общо бройки от пакети: ${total.pieces} бр.</td>
                    <td>Общо доставна цена: ${formatPrice(total.delivery)}</td>
                    <td>Общо цена едро: ${formatPrice(total.wholesale)}</td>
                    <td>Общо дребно: ${formatPrice(total.retail)}</td>
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

function calculateTotals(products) {
    const total = {
        quantity: 0,
        delivery: 0,
        retail: 0,
        wholesale: 0,
        pieces: 0,
    };

    for (const product of products) {
        total.quantity += product.quantity;
        if (product.sizes?.length)
            total.pieces += product.sizes.reduce((acc, size) => acc + size.quantity, 0);
        total.delivery += (product.deliveryPrice * product.quantity);
        total.wholesale += (product.wholesalePrice * product.quantity);
        total.retail += (product.retailPrice * (product.quantity * (product.sizes.length || 1) * (product.multiplier || 1)));
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
    const { products } = req.data;
    const total = calculateTotals(products);

    render(table({ products, print: true, total }), printContainer);
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
        const req = await axios.get(path, selectedFilters);
        const { products, count, pageCount: pgCount } = req.data;
        pageCount = pgCount;

        const total = calculateTotals(products);

        return html`
        ${table({ products, count, pageCount, total })}`
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

export function stocksOrdersPage(ctx, next) {
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