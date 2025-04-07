import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatPrice, deductVat, getVat, calculateTotalVats } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { until } from "lit/directives/until.js";
import { spinner } from "@/views/components";
import page from 'page';
import { loggedInUser } from "@/views/login";

let params, selectedFilters = {}, path, companies, total;

// set selectedFilters.from to start of month
const today = new Date();
selectedFilters.from = new Date(today.getFullYear(), today.getMonth(), 2).toISOString().split('T')[0];

const table = ({ orders }) => html`
    <table class="mt-3 table table-bordered table-striped table-hover text-center d-print-block">
        <thead>
            <tr>
                <th scope="col">Тип</th>
                <th scope="col">Номер</th>
                <th scope="col">Дата</th>
                <th scope="col">Партньор</th>
                <th scope="col">Обект</th>
                <th scope="col">Начин на плащане</th>
                <th scope="col">Сума без ДДС (20%)</th>
                <th scope="col">ДДС (20%)</th>
                <th scope="col">Сума без ДДС (9%)</th>
                <th scope="col">ДДС (9%)</th>
                <th scope="col">Сума с ДДС</th>
            </tr>
        </thead>
        <tbody>
            ${orders?.map(order => html`
                <tr>
                    <td>${params.documentTypes[order.type]}</td>
                    <td>${order.number}</td>
                    <td>${new Date(order.date).toLocaleDateString('bg')}</td>
                    <td>${order.customer.name} ${order.customer.vat ? `(${order.customer.vat})` : ''}</td>
                    <td>${order.company.name} (${order.company.vat})</td>
                    <td>${params.paymentTypes[order.paymentType]}</td>
                    <td class="text-nowrap">${formatPrice(deductVat(order.TOTALS[20]))}</td>
                    <td class="text-nowrap">${formatPrice(getVat(order.TOTALS[20]))}</td>
                    <td class="text-nowrap">${formatPrice(deductVat(order.TOTALS[9], 9))}</td>
                    <td class="text-nowrap">${formatPrice(getVat(order.TOTALS[9], 9))}</td>
                    <td class="text-nowrap">${formatPrice(order.total)}</td>
                </tr>
            `)}
            <tr class="fw-bold">
                <td colspan="6">Общо</td>
                <td class="text-nowrap">${formatPrice(deductVat(total[20]))}</td>
                <td class="text-nowrap">${formatPrice(getVat(total[20]))}</td>
                <td class="text-nowrap">${formatPrice(deductVat(total[9], 9))}</td>
                <td class="text-nowrap">${formatPrice(getVat(total[9], 9))}</td>
                <td class="text-nowrap">${formatPrice(total.total)}</td>
            </tr>
        </tbody>
    </table>
`;

async function loadReferences() {
    try {
        const req = await axios.get(path);
        const { orders } = req.data;

        total = {
            20: 0,
            9: 0,
            total: 0,
        };

        for (const order of orders) {
            const totals = calculateTotalVats(order.products);
            order.TOTALS = {
                20: 0,
                9: 0,
            }

            if (totals[20]) {
                total[20] += totals[20];
                total.total += totals[20];
                order.TOTALS[20] = totals[20];
            }

            if (totals[9]) {
                total[9] += totals[9];
                total.total += totals[9];
                order.TOTALS[9] = totals[9];
            }
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
    try {
        if (!document.execCommand('print', false, null)) {
            window.print();
        }
    } catch {
        window.print();
    }
    el.classList.remove('printTable');
}

async function applyFilters() {
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const company = document.getElementById('company').value;

    if (from)
        selectedFilters.from = from;

    if (to)
        selectedFilters.to = to;

    if (company)
        selectedFilters.company = company;
    else delete selectedFilters.company;

    const uri = Object.keys(selectedFilters).map(key => `${key}=${selectedFilters[key]}`).join('&');

    if (uri.length)
        page('/references/accounting?' + uri);
    else
        page('/references/accounting');
}

export async function accountingReferencesPage(ctx, next) {
    if (loggedInUser.role !== 'admin')
        return page('/');


    params = (await axios.get('/orders/params')).data;
    companies = (await axios.get('/companies')).data.companies;

    path = ctx.path;
    if (ctx.querystring)
        selectedFilters = Object.fromEntries(new URLSearchParams(ctx.querystring));
    else page(path + `?from=${selectedFilters.from}`); // if no filters (from or to), auto set page as start of month

    const template = () => html`
        ${nav()}
        <div class="row d-print-none p-1">
            <div class="col-6 col-sm">
                <label for="company" class="form-label">Обект:</label>
                <select @change=${applyFilters} name="company" id="company" class="form-control">
                    <option ?selected=${!selectedFilters.company} value=''>Всички</option>
                    ${companies?.map(company => html`<option ?selected=${selectedFilters?.company === company._id} value=${company._id}>${company.name}</option>`)}
                </select>
            </div>
            <div class="col-6 col-sm">
                <label for="from" class="form-label">От:</label>
                <input type="date" id="from" .value=${selectedFilters?.from || ''} @change=${applyFilters} name="from" class="form-control">
            </div>
            <div class="col-6 col-sm">
                <label for="to" class="form-label">До:</label>
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