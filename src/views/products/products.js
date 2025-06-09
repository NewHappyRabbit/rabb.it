import page from 'page';
import '@/css/products.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { nav } from '@/views/nav.js';
import { until } from 'lit/directives/until.js';
import axios from 'axios';
import { delay, unslugify, formatPrice } from '@/api';
import { spinner, toggleSubmitBtn, submitBtn } from '@/views/components';
import { loggedInUser } from '@/views/login';
import { socket } from '@/api';
import { categoriesOptions } from '@/views/categories/categories';

var path, selectedFilters = {}, pageCount;

var selectedProduct;

async function loadProducts() {
    try {
        const req = await axios.get(path)
        const { products, count, pageCount: pgCount } = req.data
        pageCount = pgCount;

        return table({ count, products, pageCount });
    } catch (err) {
        console.error(err);
        alert('Грешка при зареждане на продуктите');
        return;
    }
}

async function deleteProduct() {
    try {
        const req = await axios.delete(`/products/${selectedProduct}`);

        if (req.status === 204)
            location.reload();
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

async function onSubmitSale(e) {
    e.preventDefault();
    const btn = document.getElementById('applySaleBtn');

    const selectedProducts = [];
    const saleType = document.getElementById('saleType').value;
    const saleAmount = Number(document.getElementById('saleAmount').value);
    document.querySelectorAll('.selectedProductCheckbox:checked').forEach(e => selectedProducts.push(e.closest('tr').id));

    if (isNaN(saleAmount)) return alert('Невалидна сума');

    if (!selectedProducts.length) return alert('Моля изберете продукти');

    if (saleType === 'percent') {
        if (saleAmount < 0 || saleAmount > 100) return alert('Невалиден процент');
    }

    if (saleType === 'sum') {
        if (saleAmount < 0) return alert('Невалидна сума');
    }

    toggleSubmitBtn(btn);

    try {
        const req = await axios.put('/products/applySale', { saleType, saleAmount, products: selectedProducts });

        if (req.status === 200) {
            location.reload();
        }
    } catch (err) {
        console.error(err);
        if (err.status === 400)
            alert(err.response.data);
        else alert('Възникна грешка');
    } finally {
        toggleSubmitBtn(btn);
    }
}

const saleModal = () => html`
        <div class="modal fade" id="saleModal" tabindex="-1" aria-labelledby="saleModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <form @submit=${onSubmitSale}>
                    <div class="modal-content">
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="saleModalLabel">Намали артикули</h1>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="col">
                                <select name="saleType" id="saleType" class="form-select">
                                    <option value="percent">Намали с процент (%)</option>
                                    <option value="sum">Намали със сума (лв.)</option>
                                </select>
                            </div>
                            <div class="col pe-0 mt-3">
                                <input class="form-control border-primary" type="text" name="saleAmount" id="saleAmount" inputmode="decimal" autocomplete="off">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Затвори</button>
                            ${submitBtn({ text: 'Намали всички избрани артикули' })}
                            <!-- <button type="submit" class="btn btn-primary" id="applySaleBtn">Намали всички избрани артикули</button> -->
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

function checkAll(e) {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll('.selectedProductCheckbox');

    checked ? checkboxes.forEach(e => e.checked = true) : checkboxes.forEach(e => e.checked = false);
}

const table = ({ count, products, pageCount }) => html`
    <div class="mt-2 mb-2">Брой артикули: ${count}</div>
    <div class="table-responsive mt-2">
        <table class="table table-striped table-hover text-center">
                <thead>
                    <tr>
                        <th><input class="form-check-input" type="checkbox" value="" @change=${checkAll}></th>
                        <th scope="col">Снимка</th>
                        <th scope="col">Категория</th>
                        <th scope="col">Код</th>
                        <th scope="col">Име</th>
                        <th scope="col">Описание</th>
                        <th scope="col" class="text-nowrap">Брой пакети</th>
                        <th scope="col">Размери</th>
                        <th scope="col" class="text-nowrap">Доставна</th>
                        <th scope="col" class="text-nowrap">Едро</th>
                        <th scope="col">Дребно</th>
                        <th scope="col">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => html`
                        <tr id="${product._id}">
                            <td><input class="selectedProductCheckbox form-check-input" type="checkbox" value=""></td>
                            <td>${product?.image?.url ? html`<img class="img-thumbnail" src=${product.image.url}/>` : ''}</td>
                            <td>${product.category.path ? `${uslugifyPath(product.category.path)} > ${product.category.name}` : product.category.name}</td>
                            <td>${product.code}</td>
                            <td>${product.name}</td>
                            <td>${product.description || ''}</td>
                            <td class="text-nowrap">${product.quantity} бр.${product.openedPackages ? ' + Р' : ''}</td>
                            <td>${product.sizes.length > 0 ? sizesTemplate(product.sizes) : ''}</td>
                            <td class="text-nowrap">
                                ${product.sizes.length > 0 ? html`<div>${formatPrice(product.deliveryPrice / (product.sizes.length * (product.multiplier || 1)))}/бр.</div>` : ''}
                                <div class=${product.sizes.length > 0 ? "text-secondary" : ""}>${formatPrice(product.deliveryPrice)}</div>
                            </td>
                            <td class="text-nowrap">
                                ${product.saleWholesalePrice ? html`
                                    <div>
                                    ${product.sizes.length > 0 ? html`<div>${formatPrice(product.saleWholesalePrice / (product.sizes.length * (product.multiplier || 1)))}/бр.</div>` : ''}
                                    <div class=${product.sizes.length > 0 ? "text-secondary" : ""}>${formatPrice(product.saleWholesalePrice)}</div>
                                    </div>
                                ` : ''}
                                <div class="${product?.saleWholesalePrice ? "text-decoration-line-through" : ''}">
                                    ${product.sizes.length > 0 ? html`<div>${formatPrice(product.wholesalePrice / (product.sizes.length * (product.multiplier || 1)))}/бр.</div>` : ''}
                                    <div class=${product.sizes.length > 0 ? "text-secondary" : ""}>${formatPrice(product.wholesalePrice)}</div>
                                </div>
                            </td>
                            <td class="text-nowrap">${formatPrice(product.retailPrice)}</td>
                            <td class="text-nowrap">
                                <a href="/products/${product._id}" class="btn btn-primary"><i class="bi bi-pencil"></i><span class="d-none d-sm-inline"> ${['manager', 'admin'].includes(loggedInUser.role) ? 'Редактирай' : 'Преглед'}</span></a>
                                <button @click=${() => selectedProduct = product} class="btn btn-success" data-bs-toggle="modal" data-bs-target="#printModal"><i class="bi bi-upc"></i><span class="d-none d-sm-inline"> Етикети</span></button>
                                ${loggedInUser.role === 'admin' ? html`
                                <button @click=${() => markOutOfStock(product)} class="btn btn-danger"><i class="bi bi-box"></i> <i class="bi bi-0-square"></i><span class="d-none d-sm-inline"> Занули брой</span></button>
                                <button @click=${() => selectedProduct = product._id} class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#deleteModal"><i class="bi bi-trash"></i><span class="d-none d-sm-inline"> Изтрий</span></button>` : ''}
                            </td>
                        </tr>
                    `)}
                </tbody >
            </table >
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

    if (data.pageSize)
        selectedFilters.pageSize = data.pageSize;
    else selectedFilters.pageSize = '';

    if (data.category)
        selectedFilters.category = data.category;
    else selectedFilters.category = '';

    if (data.onlyHidden)
        selectedFilters.onlyHidden = true;
    else selectedFilters.onlyHidden = ''

    if (data.onlyOutOfStock)
        selectedFilters.onlyOutOfStock = true;
    else selectedFilters.onlyOutOfStock = ''

    if (data.onlyOpenedPackages)
        selectedFilters.onlyOpenedPackages = true;
    else selectedFilters.onlyOpenedPackages = ''

    if (e) // if coming from filters and not pagination
        delete selectedFilters.pageNumber;

    Object.keys(selectedFilters).forEach(key => selectedFilters[key] === '' && delete selectedFilters[key]);

    const uri = Object.keys(selectedFilters).map(key => `${key}=${selectedFilters[key]}`).join('&');

    if (uri.length)
        page('/products?' + uri);
    else
        page('/products');
}

async function markOutOfStock(product) {
    try {
        const req = await axios.put(`/products/markOutOfStock/${product._id}`);

        if (req.status === 200) {
            page('/products');
        }
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

async function loadCategories() {
    const req = await axios.get('/categories');
    const categories = req.data;

    const options = {
        categories,
        ...(selectedFilters?.category && { selected: selectedFilters.category }),
        showAllText: true,
    }

    return categoriesOptions(options);
}

export function productsPage(ctx, next) {
    path = ctx.path;

    // check if filters are applied
    if (ctx.querystring)
        selectedFilters = Object.fromEntries(new URLSearchParams(ctx.querystring));
    else
        selectedFilters = {};

    selectedProduct = null;

    const filters = () => html`
    <div class="col-12 col-sm" >
        <label for="search" class="form-label">Продукт:</label>
        <input @keyup=${delay(applyFilters, 300)} value=${selectedFilters?.search ? selectedFilters.search : ''} placeholder = "Въведи име или код" id="search" name="search" class="form-control" autocomplete="off">
    </div>
    <div class="col-6 col-sm">
        <label for="category" class="form-label">Категория:</label>
        <select class="form-select" name="category" id="category" required>
            ${until(loadCategories(), html`<option disabled>Зареждане...</option>`)}
        </select>
    </div>
    <div class="col-6 col-sm">
        <div class="form-check form-switch p-0">
            <label class="form-check-label d-block" for="onlyHidden">Само скрити:</label>
            <input class="form-check-input ms-0 fs-4" type="checkbox" role="switch" id="onlyHidden" ?checked=${selectedFilters?.onlyHidden} name="onlyHidden">
        </div>
    </div>
    <div class="col-6 col-sm">
        <div class="form-check form-switch p-0">
            <label class="form-check-label d-block" for="onlyOutOfStock">Само изчерпани:</label>
            <input class="form-check-input ms-0 fs-4" type="checkbox" role="switch" id="onlyOutOfStock" ?checked=${selectedFilters?.onlyOutOfStock} name="onlyOutOfStock">
        </div>
    </div>
    <div class="col-6 col-sm">
        <div class="form-check form-switch p-0">
            <label class="form-check-label d-block" for="onlyOpenedPackages">Само разбутани пакети:</label>
            <input class="form-check-input ms-0 fs-4" type="checkbox" role="switch" id="onlyOpenedPackages" ?checked=${selectedFilters?.onlyOpenedPackages} name="onlyOpenedPackages">
        </div>
    </div>
    <div class="col-6 col-sm">
        <label for="pageSize" class="form-label">Броя на страница:</label>
        <select class="form-select" name="pageSize" id="pageSize" .value=${selectedFilters?.pageSize || 15}>
            <option value="15">15</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="300">300</option>
        </select>
    </div>
`;

    const template = () => html`
        ${deleteModal()}
        ${printModal()}
        ${saleModal()}
        ${nav()}
        <div class="container-fluid">
            <a href='/products/create' class="btn btn-primary"><i class="bi bi-plus"></i> Създай продукт</a>
            <a href='/products/restock' class="btn btn-primary"><i class="bi bi-boxes"></i> Зареждане на бройки</a>
            ${loggedInUser?.role === 'admin' ? html`
                <a href='/products/revision' class="btn btn-primary"><i class="bi bi-table"></i> Ревизия</a>
                <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#saleModal"><i class="bi bi-cash"></i><span class="d-none d-sm-inline"> Намаления</span></button>
                    ` : ''}
            <form @change=${applyFilters} id="filters" class="mt-2 row align-items-end w-100">
                ${filters()}
            </form>
            ${until(loadProducts(), spinner)}
        </div>
    `;

    render(template(), container);
}