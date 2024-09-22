import page from 'page';
import '@/css/products.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { nav } from '@/views/nav.js';
import { until } from 'lit/directives/until.js';
import axios from 'axios';
import { addQuery, delay, unslugify, formatPrice } from '@/api';
import { spinner } from '@/views/components';
import { loggedInUser } from '@/views/login';
import { socket } from '@/api';

var path, pageCtx, selectedFilters = {};


var selectedProduct;

async function loadProducts() {
    try {
        const req = await axios.get(path)
        const { products, prevCursor, nextCursor, count } = req.data

        return table({ count, products, prevCursor, nextCursor });
    } catch (err) {
        console.error(err);
        alert('Грешка при зареждане на продуктите');
        return;
    }
}

async function deleteProduct() {
    try {
        const req = await axios.delete(`/products/${selectedProduct}`);

        if (req.status === 204) {
            page('/products');
        }
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

const deleteModal = () => html`
        <div class="modal fade" id="deleteModal" tabindex="-1" aria-labelledby="deleteModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="deleteModalLabel">Изтрий продукт</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    Сигурни ли сте че искате да изтриете този продукт? Това действие не може да бъде отменено.
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Откажи</button>
                    <button @click=${deleteProduct} type="button" class="btn btn-danger" data-bs-dismiss="modal">Изтрий</button>
                </div>
                </div>
            </div>
        </div>`;

function onSubmitPrint(e) {
    e.preventDefault();
    if (!socket || !socket.connected) return;

    const qty = document.getElementById('printQty');

    socket.emit('send-print', selectedProduct, Number(qty.value));

    qty.value = 1;
}

const printModal = () => html`
        <div class="modal fade" id="printModal" tabindex="-1" aria-labelledby="printModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <form @submit=${onSubmitPrint}>
                    <div class="modal-content">
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="printModalLabel">Принтирай етикет</h1>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <label for="printQty" class="form-label">Брой етикети</label>
                            <input type="number" step="1" value="1" class="form-control" id="printQty" required>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Затвори</button>
                            <button type="submit" class="btn btn-primary" data-bs-dismiss="modal">Принтирай</button>
                        </div>
                    </div>
                </form>

            </div>
        </div>`;

const sizesTemplate = (sizes) => html`
    <!-- Sum of all sizes quantity -->
    <div>${sizes.reduce((a, v) => a + v.quantity, 0)} бр.</div>

    <div class="d-flex flex-wrap gap-1">
        ${sizes.map(size => html`<span class="badge text-bg-secondary">${size.size}: ${size.quantity} бр.</span>`)}
    </div>
`;

function uslugifyPath(path) {
    var newPath = path.split(',').filter(e => e != '');
    newPath = newPath.map(e => unslugify(e));
    return newPath.join(' > ');
}

const table = ({ count, products, prevCursor, nextCursor }) => html`
    <div class="mt-2 mb-2">Брой артикули: ${count}</div>
    <div class="table-responsive mt-2">
        <table class="table table-striped table-hover text-center">
                <thead>
                    <tr>
                        <th scope="col">Снимка</th>
                        <th scope="col">Категория</th>
                        <th scope="col">Код</th>
                        <th scope="col">Име</th>
                        <th scope="col" class="text-nowrap">Брой пакети</th>
                        <th scope="col">Размери</th>
                        <th scope="col" class="text-nowrap">Доставна</th>
                        <th scope="col" class="text-nowrap">Едро</th>
                        <!-- <th scope="col">Дребно</th> -->
                        <th scope="col">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => html`
                        <tr>
                            <td>${product?.image?.url ? html`<img class="img-thumbnail" src=${product.image.url}/>` : ''}</td>
                            <td>${product.category.path ? `${uslugifyPath(product.category.path)} > ${product.category.name}` : product.category.name}</td>
                            <td>${product.code}</td>
                            <td>${product.name}</td>
                            <td class="text-nowrap">${product.quantity} бр.</td>
                            <td>${product.sizes.length > 0 ? sizesTemplate(product.sizes) : ''}</td>
                            <td class="text-nowrap">
                                ${product.sizes.length > 0 ? html`<div>${formatPrice(product.deliveryPrice / product.sizes.length)}/бр.</div>` : ''}
                                <div class=${product.sizes.length > 0 ? "text-secondary" : ""}>${formatPrice(product.deliveryPrice)}</div>
                            </td>
                            <td class="text-nowrap">
                                ${product.sizes.length > 0 ? html`<div>${formatPrice(product.wholesalePrice / product.sizes.length)}/бр.</div>` : ''}
                                <div class=${product.sizes.length > 0 ? "text-secondary" : ""}>${formatPrice(product.wholesalePrice)}</div>
                            </td>
                            <!-- <td class="text-nowrap">${formatPrice(product.retailPrice)}</td> -->
                            <td class="text-nowrap">
                                <a href="/products/${product._id}" class="btn btn-primary"><i class="bi bi-pencil"></i><span class="d-none d-sm-inline"> ${['manager', 'admin'].includes(loggedInUser.role) ? 'Редактирай' : 'Преглед'}</span></a>
                                <button @click=${() => selectedProduct = product} class="btn btn-success" data-bs-toggle="modal" data-bs-target="#printModal"><i class="bi bi-upc"></i><span class="d-none d-sm-inline"> Етикети</span></button>
                                ${loggedInUser.role === 'admin' ? html`<button @click=${() => selectedProduct = product._id} class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#deleteModal"><i class="bi bi-trash"></i><span class="d-none d-sm-inline"> Изтрий</span></button>` : ''}
                            </td>
                        </tr>
                    `)}
                </tbody >
            </table >
    <div class="d-flex justify-content-center">
        ${prevCursor ? html`<button @click=${() => switchPage(prevCursor)} class="btn btn-primary"><i class="bi bi-arrow-left"></i> Предишна страница</button>` : ''}
        ${nextCursor ? html`<button @click=${() => switchPage(nextCursor)} class="btn btn-primary">Следваща страница <i class="bi bi-arrow-right"></i></button>` : ''}
    </div>
    </div > `;

function switchPage(cursor) {
    var uri;

    uri = addQuery(pageCtx, 'cursor', cursor);

    page(uri);
}

async function applyFilters(e) {
    e.preventDefault();

    const formData = new FormData(document.getElementById('filters'));
    const data = Object.fromEntries(formData.entries());

    if (data.onlyHidden)
        data.onlyHidden = true;

    // remove empty fields
    Object.keys(data).forEach(key => data[key] === '' && delete data[key]);

    if (Object.keys(data).length === 0)
        page('/products')
    else if (data.length === 1)
        page(`/products?${Object.keys(data)[0]}=${Object.values(data)[0]} `);
    else {
        const uri = Object.keys(data).map(key => `${key}=${data[key]} `).join('&');
        page(`/products?${uri} `);
    }
}

export function productsPage(ctx, next) {
    path = ctx.path;
    pageCtx = ctx;

    // check if filters are applied
    if (ctx.querystring)
        selectedFilters = Object.fromEntries(new URLSearchParams(ctx.querystring));
    else
        selectedFilters = {};

    selectedProduct = null;

    const filters = () => html`
    <div class="col-6 col-sm" >
        <label for="search">Продукт:</label>
        <input @keyup=${delay(applyFilters, 300)} .value = ${selectedFilters?.search || ''} placeholder = "Въведи име или код" id = "search" name = "search" class="form-control" autocomplete = "off" >
    </div>
    <div class="col-6 col-sm">
        <div class="form-check form-switch p-0">
            <label class="form-check-label d-block" for="onlyHidden">Само скрити:</label>
            <input class="form-check-input ms-0 fs-4" type="checkbox" role="switch" id="onlyHidden" ?checked=${selectedFilters?.onlyHidden} name="onlyHidden">
        </div>
    </div>
`;

    const template = () => html`
        ${deleteModal()}
        ${printModal()}
        ${nav()}
<div class="container-fluid">
    <a href='/products/create' class="btn btn-primary"><i class="bi bi-plus"></i> Създай продукт</a>
    <a href='/products/restock' class="btn btn-primary"><i class="bi bi-boxes"></i> Зареждане на бройки</a>
    <form @change=${applyFilters} id="filters" class="mt-2 row align-items-end w-100">
    ${filters()}
</form>
            ${until(loadProducts(), spinner)}
        </div >
    `;

    render(template(), container);
}