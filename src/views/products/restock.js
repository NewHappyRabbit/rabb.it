import '@/css/products.css';
import { container } from "@/app.js";
import { successScan } from "@/api.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from '@/views/nav';
import { submitBtn, toggleSubmitBtn } from '@/views/components';
import Quagga from 'quagga';

var addedProducts = [], products, addedProductsIndex = 0;


function rerenderTable() {
    render(table(addedProducts), document.getElementById('table'));
}

var lastScanTime;
function scanBarcode() {
    const videoEl = document.getElementById('barcodeVideo');
    const scanBarcodeBtn = document.getElementById('scanBarcode');
    const cancelBarcodeBtn = document.getElementById('stopBarcode');
    scanBarcodeBtn.classList.add('d-none');
    cancelBarcodeBtn.classList.remove('d-none');

    const config = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: videoEl,
            constraints: {
                facingMode: "environment",
            },
        },
        decoder: {
            readers: ["ean_reader", "code_128_reader"],
        },
    };

    Quagga.init(config, function (err) {
        if (err) return console.error(err);
        Quagga.start();

        Quagga.onDetected(data => {
            const barcode = data.codeResult.code;
            const now = new Date().getTime();

            // pause scanning for 1 second to skip duplicates
            if (now < lastScanTime + 1000)
                return;

            lastScanTime = now;

            const input = document.getElementById('product');
            input.value += barcode;

            // simulate Enter key pressed on input field to activate addProduct function
            const event = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                which: 13,
                keyCode: 13,
            });

            // dispatch the event on some DOM element
            input.dispatchEvent(event);
        });
    });
}

function stopBarcode() {
    const videoEl = document.getElementById('barcodeVideo');
    const scanBarcodeBtn = document.getElementById('scanBarcode');
    const cancelBarcodeBtn = document.getElementById('stopBarcode');

    scanBarcodeBtn.classList.remove('d-none');
    cancelBarcodeBtn.classList.add('d-none');
    videoEl.innerHTML = '';
    Quagga.stop();
    Quagga.offDetected();
}

function addProduct(e) {
    e.preventDefault();

    if (e.target.value === '') return;


    // return if not any of the key combinations below (CTRL+V, MAC+V, ENTER, NUM ENTER)
    if (!(e.ctrlKey && e.key === 'v') && !(e.metaKey && e.key === 'v') && e.code !== 'Enter' && e.code !== 'NumpadEnter') return;

    var product, quantity = 1;

    // check if quantity was entered in input field
    if (e.target.value.split('*').length === 1)
        product = e.target.value;
    else {
        quantity = parseInt(e.target.value.split('*')[0]);
        quantity = !isNaN(quantity) && quantity > 0 ? quantity : 1;
        product = e.target.value.split('*')[1];
    }

    // check if product exists in db by code, barcode (13 digit) or barcode (minus the first digit because its skipped by the scanner)
    const productInDB = products.find(p => p.code === product || p.barcode === product || p.barcode.slice(1) === product);

    if (productInDB) {
        // check if product already in table and increase quantity
        addedProducts.push({
            _id: productInDB._id,
            index: addedProductsIndex++,
            code: productInDB.code,
            name: productInDB.name,
            ...(productInDB.barcode && { barcode: productInDB.barcode }),
            quantity,
            sizes: productInDB?.sizes.map(size => size.size),
            selectedSizes: productInDB?.sizes.map(size => size.size)
        });

        rerenderTable();
        successScan(e.target);
    }
    e.target.value = '';
    e.target.focus();
}

function updateQuantity(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    addedProducts[arrayIndex].quantity = e.target.value;

    rerenderTable();
}

function removeProduct(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    addedProducts = addedProducts.filter(product => product.index != index);
    rerenderTable();
}

function updateSizes(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    if (!e.target.checked)
        addedProducts[arrayIndex].selectedSizes = addedProducts[arrayIndex].selectedSizes.filter(size => size !== e.target.value);
    else
        addedProducts[arrayIndex].selectedSizes.push(e.target.value);

    rerenderTable();
}

const table = (products) => html`
    <table class="table mt-3 table-striped">
        <thead>
            <tr>
                <th>Продукт</th>
                <th>Размер</th>
                <th>Брой</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody>
            ${products.map(product => html`
                <tr addedProductsIndex=${product.index}>
                    <td>${product.name} [${product.code}]</td>
                    <td>
                        ${product.sizes.map(size => html`
                            <input @change=${updateSizes} class="form-check-input" type="checkbox" value=${size} ?checked=${product?.selectedSizes?.includes(size)} id="${product._id}-${size}">
                            <label class="form-check-label me-1" for="${product._id}-${size}">
                                ${size}
                            </label>
                        `)}
                    </td>
                    <td>
                        <input @change=${updateQuantity} name="quantity" class="form-control" type="number" .value=${product.quantity} step="1" min="1" required/>
                    </td>
                    <td>
                        <button @click=${removeProduct} type="button" class="btn btn-danger">X</button>
                    </td>
                </tr>`)}
            <tr id="addNewProduct">
                <td colspan="4">
                    <div id="barcodeVideo"></div>
                    <div class="input-group">
                        <input @keyup=${addProduct} placeholder="Баркод/код" class="form-control" type="text" name="product" id="product" autocomplete="off">
                        <button @click=${scanBarcode} class="btn btn-primary" type="button" id="scanBarcode"><i class="bi bi-camera"></i> Сканирай</button>
                        <button @click=${stopBarcode} class="btn btn-primary d-none" type="button" id="stopBarcode"><i class="bi bi-camera"></i> Затвори</button>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
`

async function restockProducts() {
    toggleSubmitBtn();
    const alertEl = document.getElementById('alert');
    const printLabelCheck = document.getElementById('printLabel').checked;

    if (addedProducts.length === 0) {
        alertEl.classList.remove('alert-success');
        alertEl.classList.add('alert-danger');
        alertEl.classList.remove('d-none');
        alertEl.textContent = 'Няма добавени продукти!';
        toggleSubmitBtn();
        return;
    }

    try {
        const res = await axios.post('/products/restock', { products: addedProducts, printLabelCheck });

        if (res.status === 200) {
            addedProductsIndex = 0;
            toggleSubmitBtn();

            alertEl.classList.remove('alert-danger');
            alertEl.classList.add('alert-success');
            alertEl.classList.remove('d-none');
            alertEl.textContent = 'Продуктите бяха успешно заредени!';

            addedProducts = [];
            rerenderTable();
        }
    } catch (err) {
        console.error(err);
        toggleSubmitBtn();

        alertEl.classList.remove('alert-success');
        alertEl.classList.add('alert-danger');
        alertEl.classList.remove('d-none');
        alertEl.textContent = err.response.data;
    }
}

export async function restockPage() {
    try {
        products = (await axios.get('/products', { params: { page: 'restock' } })).data.products;
        addedProducts = [];
        addedProductsIndex = 0;
    } catch (error) {
        alert('Грешка при зареждане на продуктите')
        console.error(error);
    }

    const template = () => html`
    ${nav()}
    <div class="container-fluid">
        <div id="table" class="table-responsive"></div>
        <div id="alert" class="d-none alert" role="alert"></div>
        <div class="mb-3">
            <input class="form-check-input" type="checkbox" value="" name="printLabel" id="printLabel" checked>
            <label class="form-check-label" for="printLabel">
                Принтирай етикети
            </label>
        </div>
        ${submitBtn({ func: restockProducts, icon: "bi-boxes", text: "Зареди бройки", type: "button", classes: "d-block mx-auto" })}
    </div>
`;

    render(template(), container);
    render(table(addedProducts), document.getElementById('table'));

    // Add listener for barcode scanner
    const barcodeInput = document.getElementById('product');
    barcodeInput.addEventListener('textInput', function (e) {
        if (e.data.length >= 10) {
            e.preventDefault();
            // Entered text with more than 10 characters at once (either by scanner or by copy-pasting value in field)
            // simulate Enter key pressed on input field to activate addProduct function
            const event = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                which: 13,
                keyCode: 13,
            });

            barcodeInput.value += e.data;
            barcodeInput.dispatchEvent(event);
        }
    });
}