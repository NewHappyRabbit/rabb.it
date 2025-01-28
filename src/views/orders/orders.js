import '@/css/orders.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatPrice } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { until } from "lit/directives/until.js";
import { spinner, toggleSubmitBtn, submitBtn } from "@/views/components";
import page from 'page';
import { loggedInUser } from "@/views/login.js";

var selectedSale, path, params, pageCount, selectedFilters = {};
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

    selectedFilters = data;

    if (data.unpaid)
        selectedFilters.unpaid = true;

    if (e) // if coming from filters and not pagination
        delete selectedFilters.pageNumber;

    Object.keys(selectedFilters).forEach(key => selectedFilters[key] === '' && delete selectedFilters[key]);


    const uri = Object.keys(selectedFilters).map(key => `${key}=${selectedFilters[key]}`).join('&');
    console.log(uri);

    if (uri.length)
        page('/orders?' + uri);
    else
        page('/orders');
}

async function markPaid(e, id) {
    toggleSubmitBtn(e.target);
    try {
        const req = await axios.put(`/orders/${id}/markPaid`);

        if (req.status === 201) {
            toggleSubmitBtn(e.target);

            // delete button, remove red glow from row and set amount to 0
            e.target.parentNode.parentNode.querySelector('.paidAmount').innerText = '';
            e.target.parentNode.parentNode.classList.remove('table-danger');
            e.target.remove();
        }
    } catch (error) {
        toggleSubmitBtn(e.target);
        console.error(error);
        alert('Възникна грешка!');
    }
}

const table = ({ count, orders, pageCount }) => html`
    <div class="mt-2 mb-2">Брой документи: ${count}</div>
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
                    <tr class="${loggedInUser.role !== 'user' && order.unpaid === true ? "table-danger" : ""}">
                        <td class="text-start">${params.documentTypes[order.type]}${order?.woocommerce ? html`<i class="bi bi-globe text-primary ms-2 fs-5"></i>` : ''}</td>
                        <td>${order.number}</td>
                        <td>${order.customer.name}</td>
                        <td>${order.company.name}</td>
                        <td>${new Date(order.date).toLocaleDateString('bg')}</td>
                        <td>${formatPrice(order.total)}</td>
                        <td>${params.paymentTypes[order.paymentType]}</td>
                        <td>${params.orderTypes[order.orderType]}</td>
                        <td class="paidAmount">${order.unpaid === true ? formatPrice(order.total - order.paidAmount) : ""}</td>
                        <td>
                            <a href="/orders/${order._id}" class="btn btn-primary"><i class="bi bi-pencil"></i> ${['manager', 'admin'].includes(loggedInUser.role) ? 'Редактирай' : 'Преглед'}</a>
                            ${loggedInUser.role === 'admin' && order.unpaid ? submitBtn({ func: (e) => markPaid(e, order._id), icon: 'bi bi-cash', text: 'Маркирай като платена', type: 'button', classes: 'btn-success' }) : ''}
                            ${loggedInUser.role === 'admin' ? html`<button @click=${() => selectedSale = order._id} class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#cancelModal"><i class="bi bi-trash"></i> Анулирай</button>` : ''}
                        </td>
                    </tr>
                `)}
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

// TODO Add filter for only woocommerce or only app orderes
const filters = ({ customers, companies, params }) => html`
        <form @change=${applyFilters} id="filters" class="row align-items-end w-100 g-3">
            <div class="col-6 col-sm">
                <label for="sort">Сортиране:</label>
                <select id="sort" name="sort" class="form-control">
                    <option ?selected=${selectedFilters?.sort === '{"_id":-1}'} value='{"_id":-1}'>Най-нови</option>
                    <option ?selected=${selectedFilters?.sort === '{"_id":1}'} value='{"_id":1}'>Най-стари</option>
                    <option ?selected=${selectedFilters?.sort === '{"total":1}'} value='{"total":1}'>Стойност ↑</option>
                    <option ?selected=${selectedFilters?.sort === '{"total":-1}'} value='{"total":-1}'>Стойност ↓</option>
                </select>
            </div>
            <div class="col-6 col-sm">
                <label for="customer">Партньор:</label>
                <input value=${(temp = customers.find(c => selectedFilters?.customer === c._id)) ? `${temp.name}${temp.vat ? ` [${temp.vat}]` : ''}${temp.phone ? ` (${temp.phone})` : ''}` : ''} list="customersList" placeholder="Всички" name="customer" id="customer" class="form-control" autocomplete="off">
                <datalist id="customersList">
                    ${customers && customers.map(customer => html`<option _id="${customer._id}" value=${`${customer.name}${customer.vat ? ` [${customer.vat}]` : ''}${customer.phone ? ` (${customer.phone})` : ''}`}></option>`)};
                </datalist>
            </div>
            <div class="col-6 col-sm">
                <label for="company">Обект:</label>
                <input value=${(temp = companies.find(c => selectedFilters?.company === c._id)) ? `${temp.name} [${temp.vat}]` : ''} list="companiesList" placeholder="Всички" name="company" id="company" class="form-control" autocomplete="off">
                <datalist id="companiesList">
                    ${companies.map(company => html`<option _id="${company._id}" value=${`${company.name} [${company.vat}]`}>`)}
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
        const [req, paramsReq, customersReq, companiesReq] = await Promise.all([
            axios.get(path),
            axios.get('/orders/params'),
            axios.get('/customers', { params: { page: 'orders' } }),
            axios.get('/companies'),
        ]);
        const { count, orders, pageCount: pgCount } = req.data;
        pageCount = pgCount;

        params = paramsReq.data;
        const customers = customersReq.data.customers;
        const companies = companiesReq.data.companies;
        return html`
        ${filters({ customers, companies, params })}
        ${table({ count, orders, pageCount })}`
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

async function deleteSale(returnQuantity = true) {
    try {
        const req = await axios.delete(`/orders/${selectedSale}`, { data: { returnQuantity } });

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
                    Сигурни ли сте че искате да анулирате продажбата?
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Откажи</button>
                    <button @click=${() => deleteSale(false)} type="button" class="btn btn-danger" data-bs-dismiss="modal">Анулирай</button>
                    <button @click=${() => deleteSale(true)} type="button" class="btn btn-danger" data-bs-dismiss="modal">Анулирай и върни количество</button>
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