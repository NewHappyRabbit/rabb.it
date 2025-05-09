import '@/css/products.css';
import { container } from "@/app.js";
import { successScan, formatPrice, fixInputPrice } from "@/api.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from '@/views/nav';
import { submitBtn, toggleSubmitBtn } from '@/views/components';

let products;

const sizesTemplate = (product, empty = false) => html`
<div class="d-flex gap-2 mt-1 pt-2 flex-wrap">
    ${product.sizes.map(size => html`
        <div class="input-group sizeElement">
            <label for="${size.size}-quantity" class="input-group-text border-primary">${size.size}</label>
            <input class="form-control border-primary" type="number" .name="${!empty ? '' : product._id + '-' + size.size}" inputmode="numeric" required .value=${empty ? '' : size.quantity} autocomplete="off" ?disabled=${!empty}>
        </div>`)
    }
</div>
`;

const table = (products) => html`
    <table class="table mt-3 table-striped">
        <thead>
            <tr>
                <th>Продукт</th>
                <th>Бройки в програма</th>
                <th>Налични бройки</th>
            </tr>
        </thead>
        <tbody>
            ${products.map(product => html`
                <tr id=${product._id}>
                    <td>${product.name} [${product.code}] (${product.barcode})</td>
                    <td>
                        ${product.sizes.length > 0 ? sizesTemplate(product) : html`<input disabled class="form-control" type="text" value=${product.quantity} />`}
                    </td>
                    <td>
                        ${product.sizes.length > 0 ? sizesTemplate(product, true) : html`<input name="${product._id}" class="form-control" type="number" inputmode="numeric" min="0" step="1" required />`}
                    </td>
                </tr>`)}
        </tbody>
    </table>
`;

async function sendData(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = document.querySelector('form');
    const formData = new FormData(form);

    const data = Object.fromEntries(formData.entries());

    const products = [];
    for (let [product, qty] of Object.entries(data)) {
        const parsedQty = parseInt(qty);
        const [id, size] = product.split('-');

        if (!size) {
            products.push({ _id: id, quantity: parsedQty });
            continue;
        }

        const found = products.find(p => p._id === id);
        if (!found) {
            products.push({ _id: id, sizes: [{ size, quantity: parsedQty }] });
            continue;
        }

        found.sizes.push({ size, quantity: parsedQty });
    }

    //TODO SEND TO BACKEND '/products/revision'
}

export async function revisionPage() {
    try {
        const req = await axios.get('/products', { params: { pageSize: '2' } });
        // const req = await axios.get('/products', { params: { pageSize: '0' } });
        products = req.data.products;
    } catch (error) {
        alert('Грешка при зареждане на продуктите')
        console.error(error);
    }

    const template = () => html`
    ${nav()}
    <div class="container-fluid">
        <form @submit=${sendData}>
            <div id="table" class="table-responsive"></div>
            <div id="alert" class="d-none alert" role="alert"></div>
            ${submitBtn({ icon: "bi-boxes", text: "Промени бройки", type: "submit", classes: "d-block mx-auto" })}
        </form>
    </div>
`;

    render(template(), container);
    render(table(products), document.getElementById('table'));
}