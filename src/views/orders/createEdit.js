import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatPrice, formatPriceNoCurrency, deductVat, markValid, markInvalid, markInvalidEl, markValidEl, successScan } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { submitBtn, toggleSubmitBtn } from "@/views/components";
import { loggedInUser } from "@/views/login";
import Quagga from 'quagga';
import page from 'page';
import { numberToBGText } from "@/api";

var order, params, companies, documentType, orderType, products, selectedCustomer, selectedCompany, customers, addedProductsIndex = 0, addedProducts = [], editPage = false;
const defaultDocumentType = 'stokova';

function changeOrderType(e) {
    orderType = e.target.value;

    // recalculate price for every added product
    addedProducts.forEach(product => {
        if (product.product) {
            product.price = orderType === 'wholesale' ? product.product.wholesalePrice : product.product.retailPrice;
        }
    })
    rerenderTable();
}

function rerenderTable() {
    orderType === 'wholesale' ? render(wholesaleProductsTable(addedProducts), document.getElementById('table')) : render(retailProductsTable(addedProducts), document.getElementById('table'));

    documentType = document.getElementById('type').value;

    render(bottomRow(params, companies), document.getElementById('bottomRow'));

    // update total in bottom row
    const total = addedProducts.reduce((acc, product) => acc + (product.price * product.quantity) * (1 - product.discount / 100), 0);
    document.getElementById('total').textContent = formatPrice(total);
}

function selectCustomer(e) {
    if (e.target.value.split('[').length < 2) return;
    const selectedVat = e.target.value.split('[')[1].split(']')[0];

    selectedCustomer = customers.find(customer => customer.vat === selectedVat);

    addedProducts.forEach(product => product.discount = selectedCustomer.discount || 0);
    rerenderTable();
    render(receiverTemplate(selectedCustomer.receivers), document.getElementById('receiverDiv'));
}

function selectCompany(e) {
    const company = e.target.value;
    selectedCompany = companies.find(c => c._id === company);
    render(senderTemplate(), document.getElementById('senderDiv'));
}

function setDiscount() {
    if (!selectedCustomer)
        return alert('Първо избери партньор!');
    let discount = prompt('Въведи обща отстъпка в %', selectedCustomer?.discount || 0);

    if (discount < 0 || isNaN(discount))
        discount = 0;
    else if (discount > 100)
        discount = 100;

    selectedCustomer.discount = discount;
    addedProducts.forEach(product => product.discount = discount);
    rerenderTable();
}

const topRow = (params, customers) => html`
    <div class="row align-items-end g-3">
        <div class="col-6 col-sm">
            <label for="customer" class="form-label">Партньор:</label>
            <input @change=${selectCustomer} .value=${order ? `${order.customer.name} [${order.customer.vat}] ${order.customer.phone ? `(${order.customer.phone})` : ''}` : ''} list="customersList" placeholder="Въведи име или булстат" name="customer" id="customer" class="form-control" autocomplete="off" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required>
            <datalist id="customersList">
                ${customers && customers.map(customer => html`<option value=${`${customer.name} [${customer.vat}] ${customer.phone ? `(${customer.phone})` : ''}`}></option>`)};
            </datalist>
        </div>
        <div class="col-6 col-sm">
            <label for="type" class="form-label">Тип на документ:</label>
            <select name="type" @change=${rerenderTable} id="type" class="form-control" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}>
                ${Object.entries(params.documentTypes).map(type => html`<option ?selected=${(order && type[0] == order.type) || (!order && type[0] === defaultDocumentType)} value=${type[0]}>${type[1]}</option>`)}
            </select>
        </div>
        <div class="col-6 col-sm">
            <label for="date" class="form-label">Дата:</label>
            <input type="date" name="date" id="date" class="form-control" ?disabled=${!['manager', 'admin'].includes(loggedInUser.role)} required>
        </div>
        <div class="col-6 col-sm">
            <label for="number" class="form-label">Документ номер:</label>
            <input type="text" name="number" id="number" inputmode="numeric" class="form-control" autocomplete="off" value=${order && order.number} disabled placeholder="Автоматично">
        </div>
        <div class="col-6 col-sm">
            <label for="orderType" class="form-label">Тип на продажба:</label>
            <select ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} @change=${changeOrderType} name="orderType" id="orderType" class="form-control" required>
                ${Object.entries(params.orderTypes).map(type => html`<option ?selected=${order && type[0] == order.orderType} value=${type[0]}>${type[1]}</option>`)}
            </select>
        </div>
        <div class="col-6 col-sm">
            <button @click=${setDiscount} type="button" class="btn btn-secondary" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}>Задай обща отстъпка</button>
        </div>
    </div>
`;

const senderTemplate = () => html`
    <label for="sender" class="form-label">Предал:</label>
    <input list="sendersList" class="form-control" name="sender" id="sender" type="text" .value=${order?.sender || selectedCompany?.senders?.slice(-1)[0] || ''} ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} autocomplete="off" required/>
    <datalist id="sendersList">
        ${selectedCompany && selectedCompany?.senders?.map(sender => html`<option value=${sender}></option>`)}
    </datalist>
`;

const receiverTemplate = (receivers) => html`
    <label for="receiver" class="form-label">Получил:</label>
    <input list="receiversList" class="form-control" name="receiver" id="receiver" type="text" .value=${order?.receiver || receivers?.slice(-1)[0] || ''} autocomplete="off" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required/>
    <datalist id="receiversList">
        ${receivers?.map(receiver => html`<option value=${receiver}></option>`)}
    </datalist>
`;

const bottomRow = (params, companies) => html`
    <div class="col-6 col-sm">
        <label for="company" class="form-label">Обект:</label>
        <select @change=${selectCompany} name="company" id="company" class="form-control" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required>
            ${companies && companies.map(company => html`<option ?selected=${order && company._id == order.company._id} value=${company._id}>${company.name}</option>`)}
        </select>
    </div>

    <div id="receiverDiv" class="col-6 col-sm"></div>

    <div id="senderDiv" class="col-6 col-sm"></div>

    <div class="col-6 col-sm">
        <label for="paymentType" class="form-label">Начин на плащане:</label>
        <select name="paymentType" id="paymentType" class="form-control" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required>
            ${Object.entries(params.paymentTypes).map(type => html`<option ?selected=${order && type[0] == order.paymentType} value=${type[0]}>${type[1]}</option>`)}
        </select>
    </div>

    <div class="col-12 col-sm">
        <label for="paidAmount" class="form-label">Платена сума:</label>
        <input class="form-control" name="paidAmount" id="paidAmount" type="text" .value=${order ? order.paidAmount : 0} autocomplete="off" inputmode="decimal" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/>
    </div>

    ${documentType === 'invoice' ? html`
        <div class="col-12 col-sm">
        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="printCopy" checked>
            <label class="form-check-label" for="printCopy">
                Копие на фактура
            </label>
        </div>

        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="printStokova" checked>
            <label class="form-check-label" for="printStokova">
                Стокова разписка
            </label>
        </div>
    </div>` : ''}

    <div class="col-12 col-sm text-center">
        <div >Общо: <span id="total"></span></div>
        ${submitBtn({ func: createEditOrder, text: "Запази и принтирай", type: "button" })}
    </div>
`;

function updateQuantity(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    if (orderType === 'wholesale') {
        if (editPage)
            addedProducts[arrayIndex].quantity = e.target.value;
        else if (+e.target.value > +e.target.max) {
            e.target.value = e.target.max;
            addedProducts[arrayIndex].quantity = e.target.max;
        }
        else
            addedProducts[arrayIndex].quantity = e.target.value;
    } else if (orderType === 'retail') {
        if (editPage) {
            addedProducts[arrayIndex].quantity = e.target.value;
        }
        else if (+e.target.value > +e.target.max) {
            e.target.value = e.target.max;
            addedProducts[arrayIndex].quantity = e.target.max;
        }
        else
            addedProducts[arrayIndex].quantity = e.target.value;
    }

    rerenderTable();
}

function updateSize(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    addedProducts[arrayIndex].size = e.target.value;

    rerenderTable();
}

function updateDiscount(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    if (e.target.value > 100)
        e.target.value = 100;
    else if (e.target.value < 0)
        e.target.value = 0;

    addedProducts[arrayIndex].discount = e.target.value;
    rerenderTable();
}

function updatePrice(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    const target = e.target;
    target.value = target.value.replace(',', '.');
    if (isNaN(Number(target.value)))
        return target.value = '';
    addedProducts[arrayIndex].price = target.value;
    rerenderTable();
}

function updateQtyInPackage(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    addedProducts[arrayIndex].qtyInPackage = e.target.value;
    rerenderTable();
}

function removeProduct(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    addedProducts = addedProducts.filter(product => product.index != index);
    rerenderTable();
}

const addProductRow = () => html`
<tr id="addNewProduct">
    <td colspan="2">
        <div class="input-group">
            <input @keyup=${addProduct} placeholder="Баркод/код" class="form-control" type="text" name="product" id="product" autocomplete="off">
            <button @click=${scanBarcode} class="btn btn-primary" type="button" id="scanBarcode"><i class="bi bi-camera"></i> Сканирай</button>
            <button @click=${stopBarcode} class="btn btn-primary d-none" type="button" id="stopBarcode"><i class="bi bi-camera"></i> Затвори</button>
        </div>
    </td>
    <td colspan="7">
        <div id="barcodeVideo"></div>
    </td>
</tr>
`;

const wholesaleProductsTable = (products) => html`
    <table class="table mt-3 table-striped">
        <thead>
            <tr>
                <th>Продукт</th>
                <th>Брой в пакет</th>
                <th>Цена за брой</th>
                <th>Пакети</th>
                <th>Цена за пакет</th>
                <th>Отстъпка %</th>
                <th>Сума</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody class="table-group-divider">
            ${products?.map(product => html`
                <tr addedProductsIndex=${product.index}>
                    <td>${product?.product?.name || product.name} ${product.product && '[#' + product.product.code + ']'}</td>
                    ${product.product ? html`<td>${product.product.sizes.length ? product.product.sizes.length + ' бр.' : ''}</td>` :
        html`<td><input @change = ${updateQtyInPackage} name = "qtyInPackage" class= "form-control".value = ${product.qtyInPackage || ""} type = "number" step = "1" min = "0" inputmode = "numeric" ? disabled = ${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>`}

                    <td>${product.product && product.product.sizes.length ? formatPrice(product.price / product.product.sizes.length) : ''}

                    <td>
                        <div class="input-group">
                            <input @change=${updateQuantity} name="quantity" class="form-control" type="number" .value=${product.quantity} step="1" min="1" inputmode="numeric" .max=${!editPage && product?.product?.quantity} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/>
                            <span class="input-group-text" id="basic-addon2">/${product?.product?.quantity || '0'}</span>
                        </div>
                    </td>

                    <td><input @change=${updatePrice} name="price" class="form-control" type="text" .value=${product.price} inputmode="decimal" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>

                    <td><input @change=${updateDiscount} name="discount" class="form-control" type="number" step="0.1" min="0" max="100" inputmode="numeric" .value=${product.discount} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>
                    <td name="subtotal">${formatPrice((product.price * product.quantity) * (1 - product.discount / 100))}</td>
                    <td style="text-align: end">
                        ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : html`<button @click=${removeProduct} type="button" class="btn btn-danger">X</button>`}</td>
                </tr>
                `)}
                
            ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : addProductRow()}
        </tbody>
    </table>
`;
// Original table for wholesale
/* const wholesaleProductsTable = (products) => html`
    <table class="table mt-3 table-striped">
        <thead>
            <tr>
                <th>Продукт</th>
                <th>Брой</th>
                <th>Брой в пакет</th>
                <th>Размери</th>
                <th>Цена</th>
                <th>Цена за размер</th>
                <th>Отстъпка %</th>
                <th>Сума</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody class="table-group-divider">
            ${products?.map(product => html`
                <tr addedProductsIndex=${product.index}>
                    <td>${product?.product?.name || product.name} ${product.product && '[#' + product.product.code + ']'}</td>
                    <td>
                        <div class="input-group">
                            <input @change=${updateQuantity} name="quantity" class="form-control" type="number" .value=${product.quantity} step="1" min="1" inputmode="numeric" .max=${!editPage && product?.product?.quantity} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/>
                            <span class="input-group-text" id="basic-addon2">/${product?.product?.quantity || '0'}</span>
                        </div>
                    </td>
                    ${product.product ? html`
                            <td>${product.product.sizes.length || ''}</td>
                            <td>${product.product.sizes.map(size => size.size).join(', ')}</td>`
        : html`<td><input @change=${updateQtyInPackage} name="qtyInPackage" class="form-control" .value=${product.qtyInPackage || ""} type="number" step="1" min="0" inputmode="numeric" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td><td></td>`
    }
                    <td><input @change=${updatePrice} name="price" class="form-control" type="text" .value=${product.price} inputmode="decimal" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>
                    <td>${product.product && product.product.sizes.length ? formatPrice(product.price / product.product.sizes.length) : ''}</td>
                    <td><input @change=${updateDiscount} name="discount" class="form-control" type="number" step="0.1" min="0" max="100" inputmode="numeric" .value=${product.discount} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>
                    <td name="subtotal">${formatPrice((product.price * product.quantity) * (1 - product.discount / 100))}</td>
                    <td>
                        ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : html`<button @click=${removeProduct} type="button" class="btn btn-danger">X</button>`}</td>
                </tr>
            `)}
            ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : addProductRow()}
        </tbody>
    </table>
`; */

const retailProductsTable = (products) => html`
    <table class="table mt-3 table-striped">
        <thead>
            <tr>
                <th>Продукт</th>
                <th>Размер</th>
                <th>Брой</th>
                <th>Цена</th>
                <th>Отстъпка %</th>
                <th>Сума</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody>
            ${products?.map(product => html`
                <tr addedProductsIndex=${product.index}>
                    <td>${product?.product?.name || product.name} ${product.product && '[#' + product.product.code + ']'}</td>
                    <td>
                        ${product.product && product.product.sizes.length ? html`
                            <select @change=${updateSize} name="size" class="form-control" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}>
                                <option ?selected=${!product?.size} disabled>Избери</option>
                                ${product.product.sizes.map(size => html`<option value=${size.size} ?selected=${size.size === product.size} ?disabled=${size.quantity < 1}>${size.size}</option>`)}
                            </select>` : product.product ? '' : html`<input @change=${updateSize} name="size" class="form-control" type="text" .value=${product?.size || ''} ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} />`}
                    </td>
                    <td>
                        <div class="input-group">
                            <input @change=${updateQuantity} name="quantity" class="form-control" type="number" .value=${product.quantity} step="1" min="1" inputmode="numeric" .max=${!editPage && (product.size ? product?.product?.sizes.find(s => s.size == product.size).quantity : product?.product?.quantity || '')}  required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/>
                            <span class="input-group-text" id="basic-addon2">/${product.size ? product?.product?.sizes.find(s => s.size == product.size).quantity : product?.product?.quantity || ''}</span>
                        </div >
                    </td >
                    <td><input @change=${updatePrice} name="price" class="form-control" type="text" .value=${product.price} inputmode="decimal" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>
                    <td><input @change=${updateDiscount} name="discount" class="form-control" type="number" step="0.1" inputmode="numeric" .value=${product.discount} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>
                    <td name="subtotal">${formatPrice((product.price * product.quantity) * (1 - product.discount / 100))}</td>
                    <td>
                        ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : html`<button @click=${removeProduct} type="button" class="btn btn-danger">X</button>`}</td>
                </tr >
    `)}
            ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : addProductRow()}
        </tbody>
    </table>
`;

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
        if (err) return console.log(err);
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

    console.log(e, e.target.value)

    if (e.target.value === '')
        return;

    // check if copy-pasted or enter was pressed
    if ((e.ctrlKey && e.key === 'v' || e.code === 'MetaLeft') || e.code === 'Enter' || e.code === 'NumpadEnter') {
        var product, quantity = 1;

        if (orderType === 'wholesale') {
            // check if quantity was entered
            if (e.target.value.split('*').length === 1)
                product = e.target.value;
            else {
                quantity = +e.target.value.split('*')[0];
                quantity = quantity > 0 ? quantity : 1;
                product = e.target.value.split('*')[1];
            }

            // check if product exists in db by code, barcode (13 digit) or barcode (minus the first digit because its skipped by the scanner)
            const productInDB = products.find(p => p.code === product || p.barcode === product || p.barcode.slice(1) === product);

            if (productInDB) {
                // check if product already in table and increase quantity
                if (addedProducts.find(p => p.product && p.product._id === productInDB._id)) {
                    const index = addedProducts.findIndex(p => p.product && p.product._id === productInDB._id);

                    addedProducts[index].quantity = +addedProducts[index].quantity + quantity;

                    // check if product quantity has been exceeded and set to max
                    if (addedProducts[index].quantity > productInDB.quantity)
                        addedProducts[index].quantity = productInDB.quantity;
                }
                else
                    addedProducts.push({
                        index: addedProductsIndex++,
                        product: productInDB,
                        quantity: quantity > productInDB.quantity ? productInDB.quantity : quantity,
                        price: orderType === 'wholesale' ? productInDB.wholesalePrice : productInDB.retailPrice,
                        discount: selectedCustomer?.discount || 0
                    });
            } else
                addedProducts.push({
                    index: addedProductsIndex++,
                    name: product,
                    quantity,
                    price: 0,
                    qtyInPackage: 0,
                    discount: selectedCustomer?.discount || 0
                });
        } else if (orderType === 'retail') {
            product = e.target.value;
            // check if product exists in db by code, barcode (13 digit) or barcode (minus the first digit because its skipped by the scanner)
            const productInDB = products.find(p => p.code === product || p.barcode === product || p.barcode.slice(1) === product);

            if (productInDB) {
                // Check if product already in table and increase quantity
                if (addedProducts.find(p => p.product && p.product._id === productInDB._id)) {
                    const index = addedProducts.findIndex(p => p.product && p.product._id === productInDB._id);

                    addedProducts[index].quantity = +addedProducts[index].quantity + 1;

                    // check if product size qty has been exceeded and set to max
                    if (addedProducts[index].size && addedProducts[index].quantity > productInDB.sizes.find(size => size.size === addedProducts[index].size).quantity)
                        addedProducts[index].quantity = productInDB.sizes.find(size => size.size === addedProducts[index].size).quantity;
                }
                else
                    addedProducts.push({
                        index: addedProductsIndex++,
                        product: productInDB,
                        quantity: 1,
                        price: productInDB.retailPrice,
                        discount: selectedCustomer?.discount || 0
                    });
            }
            else {
                addedProducts.push({
                    index: addedProductsIndex++,
                    name: product,
                    quantity,
                    price: 0,
                    discount: selectedCustomer?.discount || 0
                });
            }
        }

        successScan(e.target);
        rerenderTable();

        e.target.value = '';
        e.target.focus();
    }
}

function validateOrder(data) {
    var invalidFlag = false;

    if (!data.customer) {
        markInvalid('customer');
        invalidFlag = true;
    } else markValid('customer');

    if (!data.type) {
        markInvalid('type');
        invalidFlag = true;
    } else markValid('type');

    if (!data.date) {
        markInvalid('date');
        invalidFlag = true;
    } else markValid('date');

    if (!data.orderType) {
        markInvalid('orderType');
        invalidFlag = true;
    } else markValid('orderType');

    if (!data.paymentType) {
        markInvalid('paymentType');
        invalidFlag = true;
    } else markValid('paymentType');

    if (data.paidAmount < 0) {
        markInvalid('paidAmount');
        invalidFlag = true;
    } else markValid('paidAmount');

    if (!data.company) {
        markInvalid('company');
        invalidFlag = true;
    } else markValid('company');

    if (!data.receiver) {
        markInvalid('receiver');
        invalidFlag = true;
    } else markValid('receiver');

    if (!data.sender) {
        markInvalid('sender');
        invalidFlag = true;
    } else markValid('sender');

    if (data.products.length === 0)
        invalidFlag = true;

    data.products.forEach(product => {
        const row = document.querySelector(`tr[addedProductsIndex="${product.index}"]`);

        if (!product.name && !product.product)
            invalidFlag = true;

        if (product.name && orderType === 'wholesale') {
            if (product.qtyInPackage < 0) {
                markInvalidEl(row.querySelector('input[name="qtyInPackage"]'));
                invalidFlag = true;
            } else markValidEl(row.querySelector('input[name="qtyInPackage"]'));
        }

        if (product.product && orderType === 'retail') {
            const sizeEl = row.querySelector('select[name="size"]');

            if (sizeEl && !product.size) {
                markInvalidEl(sizeEl);
                invalidFlag = true;
            } else if (sizeEl && product.size) markValidEl(sizeEl);
        }

        if (product.name && orderType === 'retail') {
            if (!product.quantity || product.quantity < 1) {
                markInvalidEl(row.querySelector('input[name="quantity"]'));
                invalidFlag = true;
            } else markValidEl(row.querySelector('input[name="quantity"]'));
        }

        if (product.discount < 0 || product.discount > 100) {
            markInvalidEl(row.querySelector('input[name="discount"]'));
            invalidFlag = true;
        } else markValidEl(row.querySelector('input[name="discount"]'));

        if (!product.price || product.price < 0.01) {
            markInvalidEl(row.querySelector('input[name="price"]'));
            invalidFlag = true;
        } else markValidEl(row.querySelector('input[name="price"]'));

        if (!product.quantity || product.quantity < 1) {
            markInvalidEl(row.querySelector('input[name="quantity"]'));
            invalidFlag = true;
        } else markValidEl(row.querySelector('input[name="quantity"]'));
    });

    return invalidFlag;
}

async function createEditOrder() {
    if (order && !['manager', 'admin'].includes(loggedInUser.role)) // normal user editing, just print because they cant edit anything
        return printSale(order);

    toggleSubmitBtn();

    const form = document.querySelector('form');
    form.classList.add('was-validated');
    form.classList.remove('needs-validation')
    const formData = new FormData(form);
    var filteredProducts = [];

    // transform addedProducts to the type used in backend
    if (orderType === 'wholesale') {
        addedProducts.forEach(product => {
            if (product.product)
                filteredProducts.push({
                    index: product.index,
                    product: product.product._id,
                    quantity: product.quantity,
                    price: product.price,
                    discount: product.discount
                });
            else
                filteredProducts.push({
                    index: product.index,
                    name: product.name,
                    quantity: product.quantity,
                    price: product.price,
                    ...(product.qtyInPackage > 0 && { qtyInPackage: product.qtyInPackage }),
                    discount: product.discount
                });
        });
    } else if (orderType === 'retail') {
        addedProducts.forEach(product => {
            if (product.product)
                filteredProducts.push({
                    index: product.index,
                    product: product.product._id,
                    quantity: product.quantity,
                    price: product.price,
                    ...(product.size && { size: product.size }),
                    discount: product.discount
                });
            else
                filteredProducts.push({
                    index: product.index,
                    name: product.name,
                    quantity: product.quantity,
                    price: product.price,
                    size: product.size,
                    discount: product.discount
                });
        });
    }

    const data = {
        date: document.getElementById('date').value,
        type: documentType,
        customer: selectedCustomer?._id,
        orderType: orderType,
        products: filteredProducts,
        paymentType: document.getElementById('paymentType').value,
        paidAmount: +(formData.get('paidAmount').replace(',', '.')),
        company: document.getElementById('company').value,
        receiver: document.getElementById('receiver').value,
        sender: document.getElementById('sender').value
    }

    const invalidData = validateOrder(data);

    if (invalidData) {
        form.classList.remove('was-validated');
        return toggleSubmitBtn();
    }

    const alertEl = document.getElementById('alert');
    try {
        const req = order ? await axios.put(`/orders/${order._id}`, data) : await axios.post('/orders', data);

        if (req.status === 201) {
            toggleSubmitBtn();
            alertEl.classList.add('d-none');
            document.getElementById('orderType').disabled = true;
            document.getElementById('number').value = req.data.number;
            printSale(req.data);
            // after printing, go to edit page of same order
            page(`/orders/${req.data._id}`);
        }
    } catch (err) {
        toggleSubmitBtn();
        console.error(err);
        if (err.response.status === 400) {
            alertEl.classList.remove('d-none', 'alert-success');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = err.response.data;
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');

            if (err.response.data.toLowerCase().includes('vat')) {
                markInvalid('vat');
            }

            if (err.response.data.toLowerCase().includes('phone')) {
                markInvalid('phone');
            }

            if (err.response.data.toLowerCase().includes('discount')) {
                markInvalid('discount');
            }
        }
        else if (err.response?.status === 500) {
            alertEl.classList.remove('d-none', 'alert-success');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = 'Грешка в сървъра';
            console.error(err);
        } else console.error(err)
    }
}

async function printSale(data) {
    const printCopy = document.getElementById('printCopy')?.checked || false;
    const printStokova = document.getElementById('printStokova')?.checked || false;

    // should print something like this: invoice original, invoice copy, etc etc depending on whats selected as type
    const printPages = [];
    printPages.push(printContainer(data));
    if (printCopy === true) // print a copy of the invoice
        printPages.push(printContainer(data, { copy: true }));

    if (printStokova === true) // print stokova of the invoice
        printPages.push(printContainer(data, { stokova: true }));

    render(printPages, document.getElementById('printContainer'));
    window.print();
}

// invoice should have deducted tax in product price and shown as sum at the end
// stokova should have all products with tax included in price and shown as sum at the end
const printContainer = (data, param) => html`
    <div style="break-after:page;">
        <h1 class="text-center fw-bold">${param?.stokova ? 'Стокова разписка' : params.documentTypes[data.type]}</h1>
        <div class="text-center fs-5">${param?.copy ? 'Копие' : 'Оригинал'}</div>
        <div class="d-flex justify-content-between">
            ${param?.stokova ? '' : html`<div>Документ №: <span class="fw-bold">${data.number}</span></div>`}
            <div>Дата: <span class="fw-bold">${new Date(data.date).toLocaleDateString('bg')}</span></div>
        </div>
        <div class="row gap-3 p-3">
            <div class="col border rounded">
                <div>Получател: ${data.customer.name}</div>
                ${data.customer?.taxvat ? html`<div>ДДС №: ${data.customer.taxvat}</div>` : ''}
                <div>Идент. №: ${data.customer.vat}</div>
                <div>Адрес: ${data.customer.address}</div>
                <div>МОЛ: ${data.customer.mol}</div>
                <div>Телефон: ${data.customer?.phone || ''}</div>
            </div>
            <div class="col border rounded">
                <div>Доставчик: ${data.company.name}</div>
                ${data.company?.taxvat ? html`<div>ДДС №: ${data.company.taxvat}</div>` : ''}
                <div>Идент. № ${data.company.vat}</div>
                <div>Адрес: ${data.company.address}</div>
                <div>МОЛ: ${data.company.mol}</div>
                <div>Телефон: ${data.company?.phone || ''}</div>
            </div>

            ${data.orderType === 'wholesale' ? printTableWholesale(data.company.tax, data.products, param?.stokova ? 'stokova' : data.type) : printTableRetail(data.company.tax, data.products, param?.stokova ? 'stokova' : data.type)}
            <div style="font-size: 1rem">
                Словом: ${numberToBGText(data.total)}
            </div>

            <div class="d-flex flex-column text-end">
                ${param?.stokova || data.type === 'stokova' ? '' : html`<div>Данъчна основа ${data.company.tax}%: ${formatPrice(deductVat(data.total, data.company.tax))}</div>`}
                ${param?.stokova || data.type === 'stokova' ? '' : html`<div>ДДС ${data.company.tax}%: ${formatPrice(data.total - deductVat(data.total, data.company.tax))}</div>`}
                <div class="fw-bold">Сума за плащане: ${formatPrice(data.total)}</div>
            </div>

            <div>
                <div>Плащане: ${params.paymentTypes[data.paymentType]}</div>
                ${data.paymentType === 'bank' ? html`
                    <div>IBAN: ${data.company.bank.iban}</div>
                    <div>Банка: ${data.company.bank.name}</div>
                    <div>Банков код: ${data.company.bank.code}</div>` : ''}
            </div>
            <div class="d-flex justify-content-between">
                <div>Получил: ${data.receiver}</div>
                <div>Съставил: ${data.sender}</div>
            </div>
    </div>
`;

const printTableWholesale = (tax, products, type) => html`
    <table class="table table-bordered">
        <thead>
            <tr class="fw-bold text-center">
                <td>№</td>
                <td>Код</td>
                <td>Продукт</td>
                <td>Пакети</td>
                <td>Броя в пакет</td>
                <td>Цена</td>
                <td>Отстъпка</td>
                <td>Цена след ТО%</td>
                <td>Цена за размер след ТО%</td>
                <td>Сума</td>
            </tr>
        </thead>
        <tbody>
            ${products.map((product, index) => html`
                <tr class="text-center">
                    <td>${++index}</td>
                    <td>${product?.product?.code || ''}</td>
                    <td>${product?.product?.name || product.name}</td>
                    <td>${product.quantity}</td>
                    <td>${product?.product?.sizes?.length || product.qtyInPackage}</td>
                    <td>${formatPriceNoCurrency(type === 'stokova' ? product.price : deductVat(product.price, tax))}</td>
                    <td>${product?.discount > 0 ? product.discount + '%' : '0%'}</td>
                    <td>${product?.discount ? formatPriceNoCurrency(type === 'stokova' ? product.price * (1 - product.discount / 100) : deductVat(product.price * (1 - product.discount / 100), tax)) : formatPriceNoCurrency(type === 'stokova' ? product.price : deductVat(product.price, tax))}</td>
                    <td>${product.qtyInPackage || product?.product?.sizes.length ? formatPriceNoCurrency(type === 'stokova' ? (product.price / (product?.product?.sizes?.length || product.qtyInPackage) * (1 - product.discount / 100)) : deductVat((product.price / (product?.product?.sizes?.length || product.qtyInPackage) * (1 - product.discount / 100)), tax)) : ''}</td>
                    <td>${formatPriceNoCurrency(type === 'stokova' ? ((product.price * product.quantity) * (1 - product.discount / 100)) : deductVat((product.price * product.quantity) * (1 - product.discount / 100), tax))}</td>
                </tr>
            `)}
        </tbody>
    </table>
`;

const printTableRetail = (tax, products, type) => html`
<table class="table table-bordered">
        <thead>
            <tr class="fw-bold text-center">
                <td>№</td>
                <td>Код</td>
                <td>Продукт</td>
                <td>Размер</td>
                <td>Брой</td>
                <td>Цена</td>
                <td>Отстъпка %</td>
                <td>Цена след ТО%</td>
                <td>Сума</td>
            </tr>
        </thead>
        <tbody>
            ${products.map((product, index) => html`
                <tr class="text-center">
                    <td>${++index}</td>
                    <td>${product?.product?.code || ''}</td>
                    <td>${product?.product?.name || product.name}</td>
                    <td>${product?.size}</td>
                    <td>${product.quantity}</td>
                    <td>${formatPriceNoCurrency(type === 'stokova' ? product.price : deductVat(product.price, tax))}</td>
                    <td>${product?.discount || ''}</td>
                    <td>${product?.discount ? formatPriceNoCurrency(type === 'stokova' ? product.price * (1 - product.discount / 100) : deductVat((product.price * (1 - product.discount / 100)), tax)) : ''}</td>
                    <td>${formatPriceNoCurrency(type === 'stokova' ? ((product.price * product.quantity) * (1 - product.discount / 100)) : deductVat((product.price * product.quantity) * (1 - product.discount / 100), tax))}</td>
                </tr>
            `)}
        </tbody>
    </table>
`;

const template = (params, customers) => html`
    ${nav()}
    <div class="container-fluid d-print-none">
        <form novalidate class="mt-3">
            ${topRow(params, customers)}
            <div id="table" class="table-responsive"></div>
            <div id="bottomRow" class="row g-3 align-items-end"></div>
        </form>
        <div id="alert" class="alert d-none"></div>
    </div>
    <div id="printContainer" class="d-none d-print-block"></div>`;

export async function createEditSalePage(ctx, next) {
    try {
        params = (await axios.get('/orders/params')).data;
        companies = (await axios.get('/companies')).data;
        customers = (await axios.get('/customers/forSales')).data;
        products = (await axios.get('/products/all')).data;
        addedProductsIndex = 0;

        if (ctx.params.id) {
            editPage = true;
            const req = await axios.get(`/orders/${ctx.params.id}`);
            order = req.data;
            orderType = order.orderType;
            addedProducts = order.products;
            addedProducts.map(product => product.index = addedProductsIndex++);
            selectedCustomer = order.customer;
            selectedCompany = companies.filter(c => c._id === order.company)[0];
        } else {
            editPage = false;
            order = undefined;
            orderType = 'wholesale';
            addedProducts = [];
            selectedCompany = companies[0];
        }

        render(template(params, customers), container);
        rerenderTable();
        render(senderTemplate(), document.getElementById('senderDiv'));
        render(receiverTemplate(), document.getElementById('receiverDiv'));

        // Set date in field
        document.getElementById('date').valueAsDate = order ? new Date(order.date) : new Date();

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
    } catch (err) {
        console.error(err);
        alert('Възникна грешка')
    }
}