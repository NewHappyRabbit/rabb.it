import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatPrice, deductVat, getVat } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { until } from "lit/directives/until.js";
import { spinner } from "@/views/components";
import page from 'page';
import { loggedInUser } from "@/views/login";

let selectedFilters = {}, path, total = {
    vat: 0,
    totalNoVat: 0,
    total: 0,
};

// set selectedFilters.from to start of month
const today = new Date();
selectedFilters.from = new Date(today.getFullYear(), today.getMonth(), 2).toISOString().split('T')[0];

const table = ({ orders }) => html`
    <table class="mt-3 table table-bordered table-striped table-hover text-center d-print-block">
        <thead>
            <tr>
                <th scope="col">Номер</th>
                <th scope="col">Дата</th>
                <th scope="col">Партньор</th>
                <th scope="col">Обект</th>
                <th scope="col">Начин на плащане</th>
                <th scope="col">Сума без ДДС</th>
                <th scope="col">ДДС</th>
                <th scope="col">Сума с ДДС</th>
            </tr>
        </thead>
        <tbody>
            ${orders?.map(order => html`
                <tr>
                    <td>${order.number}</td>
                    <td>${new Date(order.date).toLocaleDateString('bg')}</td>
                    <td>${order.customer.name} ${order.customer.vat ? `(${order.customer.vat})` : ''}</td>
                    <td>${order.company.name} (${order.company.vat})</td>
                    <td>${new Date(order.date).toLocaleDateString('bg')}</td>
                    <td class="text-nowrap">${formatPrice(deductVat(order.total, order.company.tax))}</td>
                    <td class="text-nowrap">${formatPrice(getVat(order.total, order.company.tax))}</td>
                    <td class="text-nowrap">${formatPrice(order.total)}</td>
                </tr>
            `)}
        </tbody>
        <tfoot class="fw-bold">
            <tr>
                <td colspan="5">Общо</td>
                <td class="text-nowrap">${formatPrice(total.totalNoVat)}</td>
                <td class="text-nowrap">${formatPrice(total.vat)}</td>
                <td class="text-nowrap">${formatPrice(total.total)}</td>
            </tr>
        </tfoot>
    </table>
`;

async function loadReferences() {
    try {
        const req = await axios.get(path)
        const { orders } = req.data;

        console.log({ path })

        total = {
            vat: 0,
            totalNoVat: 0,
            total: 0,
        };

        for (const order of orders) {
            const vat = getVat(order.total, order.company.tax);
            total.vat += vat;
            total.totalNoVat += order.total - vat;
            total.total += order.total;
        }

        return html`${table({ orders })}`
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

function print() {
    const el = document.querySelector('table');
    el.classList.add('printTable');
    window.print();
    el.classList.remove('printTable');
}

async function applyFilters() {
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;

    if (from)
        selectedFilters.from = from;

    if (to)
        selectedFilters.to = to;

    const uri = Object.keys(selectedFilters).map(key => `${key}=${selectedFilters[key]}`).join('&');

    if (uri.length)
        page('/references/accounting?' + uri);
    else
        page('/references/accounting');
}

export function accountingReferencesPage(ctx, next) {
    if (loggedInUser.role !== 'admin')
        return page('/');

    path = ctx.path;
    if (ctx.querystring)
        selectedFilters = Object.fromEntries(new URLSearchParams(ctx.querystring));
    else page(path + `?from=${selectedFilters.from}`); // if no filters (from or to), auto set page as start of month

    const template = () => html`
        ${nav()}
        <div class="row d-print-none">
            <div class="col-6 col-sm">
                <label for="from">От:</label>
                <input type="date" id="from" .value=${selectedFilters?.from || ''} @change=${applyFilters} name="from" class="form-control">
            </div>
            <div class="col-6 col-sm">
                <label for="to">До:</label>
                <input type="date" id="to" .value=${selectedFilters?.to || ''} @change=${applyFilters} name="to" class="form-control">
            </div>
        </div>
        <div class="container-fluid">
            <button @click=${print} class="btn btn-primary d-print-none">Принтирай</button>
            <div class="table-responsive">
                ${until(loadReferences(), spinner)}
            </div>
        </div>
    `;

    render(template(), container);
}