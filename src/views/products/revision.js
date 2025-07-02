import '@/css/products.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from '@/views/nav';
import { submitBtn, toggleSubmitBtn } from '@/views/components';
import page from 'page';
import { spinner } from '@/views/components';
import { until } from 'lit/directives/until.js';

let dbProducts;

function checkInput(e) {
    const input = e.target;
    // get value as int
    const value = parseInt(input.value);

    if (isNaN(value) || value < 0 || value == 'e' || value == '-') input.value = '';
    else input.value = value;
}

const sizesTemplate = (product, empty = false) => html`
<div class="d-flex gap-2 mt-1 pt-2 flex-wrap">
    ${product.sizes.map(size => html`
        <div class="input-group sizeElement">
            <label for="${size.size}***quantity" class="input-group-text border-primary">${size.size}</label>
            <input @keyup=${checkInput} @change=${checkInput} class="form-control border-primary" type="number" .name="${!empty ? '' : product._id + '***' + size.size}" inputmode="numeric" .value=${empty ? '' : size.quantity} autocomplete="off" ?disabled=${!empty}>
        </div>`)
    }
</div>
`;

function copyQty(e) {
    const input = e.target;
    const tr = input.closest('tr');

    const product = dbProducts.find(p => p._id == tr.id);
    if (product.sizes.length) {
        product.sizes.forEach(size => {
            const input = tr.querySelector(`[name="${product._id}***${size.size}"]`);
            input.value = size.quantity;
        })
    } else {
        const input = tr.querySelector(`[name="${product._id}"]`);
        input.value = product.quantity;
    }
}

const table = (products) => html`
    <h5 style="padding-top: 20px">Остават още ${products.length} продукта до приключване на ревизията</h5>
    <form @submit=${sendData}>
        <div id="table" class="table-responsive">
            <table class="table mt-3 table-striped">
                <thead>
                    <tr>
                        <th>Продукт</th>
                        <th>Бройки в програма</th>
                        <td></td>
                        <th>Налични бройки</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => html`
                            <tr id=${product._id} code=${product.code} barcode=${product.barcode}>
                                <td>${product.name} [${product.code}] (${product.barcode})</td>
                                <td>
                                    ${product.sizes.length > 0 ? sizesTemplate(product) : html`<input disabled class="form-control" type="text" value=${product.quantity} />`}
                                </td>
                                <td><button class="form-control" type="button" @click=${copyQty}><i class="bi bi-arrow-right"></i></button></td>
                                <td>
                                    ${product.sizes.length > 0 ? sizesTemplate(product, true) : html`<input name="${product._id}" class="form-control" type="number" inputmode="numeric" min="0" step="1" @keyup=${checkInput} @change=${checkInput} />`}
                                </td>
                            </tr>`)}
                </tbody>
            </table>
        </div>
        ${submitBtn({ icon: "bi-boxes", text: "Запази", type: "submit", classes: "d-block mx-auto" })}
    </form>
`;

async function sendData(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = document.querySelector('form');
    const formData = new FormData(form);

    const data = Object.fromEntries(formData.entries());

    const products = [];
    for (let [product, qty] of Object.entries(data)) {
        if (qty == "") continue;
        const parsedQty = parseInt(qty);
        const [id, size] = product.split('***');

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

    // Filter out any product with sizes that doesnt have quantity entered for all sizes
    const filtered = products.filter(p => !p.sizes || p.sizes?.length == dbProducts.find(db => db._id === p._id).sizes.length);

    if (filtered.length == 0) return toggleSubmitBtn();

    try {
        const req = await axios.post('/products/revision', filtered);
        if (req.status === 200) {
            page('/products/revision');
        } else {
            console.error(req);
            alert(req.response.data);
        }
    } catch (err) {
        console.error(err);
        alert(err.response.data);
    }
}

async function startRevision() {
    try {
        const req = await axios.post('/products/revision/start');
        if (req.status === 200) {
            page('/products/revision');
        } else {
            console.error(req);
            alert(req.response.data);
        }
    } catch (err) {
        console.error(err);
        alert(err.response.data);
    }
}

async function loadProducts() {
    try {
        const req = await axios.get('/products', { params: { page: 'revision' } });
        dbProducts = req.data.products;

        if (dbProducts.length == 0) return;

        return table(dbProducts);
    } catch (error) {
        alert('Грешка при зареждане на продуктите')
        console.error(error);
        return;
    }
}

function findInPage(e) {
    const value = e.target.value;

    if (value === '') return;
    let el;

    if (!el) {
        el = document.querySelector(`tr[barcode="${value}"]`);
    }

    if (!el) {
        el = document.querySelector(`tr[barcode="0${value}"]`);
    }

    if (!el) {
        el = document.querySelector(`tr[barcode="${value.slice(0, -1)}"]`);
    }

    if (!el) {
        el = document.querySelector(`tr[barcode="${value.slice(1)}"]`);
    }

    if (!el) {
        el = document.querySelector('tr[code="' + value + '"]');
    }

    if (!el) return;

    e.target.value = '';
    e.target.blur();

    document.querySelector('.table-info')?.classList.remove('table-info');

    el.classList.add('table-info');
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
}

export async function revisionPage() {
    const template = () => html`
    ${nav()}
    <input placeholder="Търси по баркод" id="search" class="form-control text-center" type="text" @change=${findInPage} style="z-index: 1000; margin-top: -8px; position: fixed;" />

    <div class="container-fluid" style="margin-top: 30px">
        ${until(loadProducts(), spinner)}
        <button class="btn btn-danger d-block mx-auto mt-5" @click=${startRevision}>Започни ревизия</button>
    </div>
`;

    render(template(), container);
}