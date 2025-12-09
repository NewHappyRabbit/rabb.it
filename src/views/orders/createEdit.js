import '@/css/orders.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { formatDate, formatPrice, formatPriceNoCurrency, deductVat, markValid, markInvalid, markInvalidEl, markValidEl, successScan, BGNtoEuro } from '@/api.js';
import { nav } from "@/views/nav";
import axios from "axios";
import { submitBtn, toggleSubmitBtn } from "@/views/components";
import { loggedInUser } from "@/views/login";
import Quagga from 'quagga';
import page from 'page';
import { numberToBGText, priceRegex, fixInputPrice, pad, calculateTotalVats, socket } from "@/api";
import { customerForm } from '@/views/customers/createEdit';

var order, defaultValues, params, companies, documentType, orderType, selectedCustomer, selectedCompany, customers, addedProductsIndex = 0, addedProducts = [], documentNumber, isMobileDevice;


function changeOrderType(e) {
    orderType = e.target.value;

    // recalculate price for every added product
    addedProducts.forEach(product => {
        if (product.product)
            product.price = orderType === 'wholesale' ? product.product.wholesalePrice : product.product.retailPrice;
    })
    rerenderTable();
}

async function selectDocumentType(e) {
    documentType = e.target.value;
    await getDocumentTypeNumber();
    rerenderTable();
}

function rerenderTable() {
    orderType === 'wholesale' ? render(wholesaleProductsTable(addedProducts), document.getElementById('table')) : render(retailProductsTable(addedProducts), document.getElementById('table'));

    render(bottomRow(params, companies), document.getElementById('bottomRow'));

    if (order?.woocommerce)
        render(woocommerceTemplate(), document.getElementById('woocommerce'));

    render(secondTopRow(), document.getElementById('secondTopRowContainer'));

    if (order?.type === 'credit' || documentType === 'credit')
        document.getElementById('secondTopRowContainer').classList.remove('d-none');
    else
        document.getElementById('secondTopRowContainer').classList.add('d-none');

    // update total in bottom row
    const total = addedProducts.reduce((acc, product) => acc + (product.price * product.quantity) * (1 - product.discount / 100), 0);
    document.getElementById('total').textContent = formatPrice(total);
}

function selectCustomer(e) {
    var selectedId = document.querySelector(`datalist option[value='${e.target.value}']`).getAttribute('_id');
    selectedCustomer = customers.find(customer => customer._id === selectedId);

    addedProducts.forEach(product => product.discount = selectedCustomer.discount || 0);
    rerenderTable();
    render(receiverTemplate(selectedCustomer.receivers), document.getElementById('receiverDiv'));
}

async function selectCompany(e) {
    const company = e.target.value;
    selectedCompany = companies.find(c => c._id === company);
    render(senderTemplate(selectedCompany.senders), document.getElementById('senderDiv'));
    await getDocumentTypeNumber();

    for (let product of addedProducts) {
        if (selectedCompany.tax === 0)
            product.vat = 0;
        else
            product.vat = product.originalVat;
    }
    rerenderTable();
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
        <div class="col-6 col-sm">
            <label for="customer" class="form-label">Партньор:</label>
            <div class="input-group">
                <input @keyup=${e => e.target.value = e.target.value.toLowerCase()} @change=${selectCustomer} .value=${selectedCustomer ? `${selectedCustomer.taxvat ? '✅ ' : ''}${selectedCustomer.name.toLowerCase()}${selectedCustomer.vat ? ` [${selectedCustomer.vat}]` : ''}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}` : ''} list="customersList" placeholder="Въведи име или булстат" name="customer" id="customer" class="form-control" autocomplete="off" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required>
                <button data-bs-toggle="modal" data-bs-target="#createCustomerModal" class="btn btn-outline-primary" type="button"><i class="bi bi-plus-lg"></i></button>
            </div>
            <datalist id="customersList">
                ${customers && customers.map(customer => html`<option _id="${customer._id}" value=${`${customer.taxvat ? '✅ ' : ''}${customer.name.toLowerCase()}${customer.vat ? ` [${customer.vat}]` : ''}${customer.phone ? ` (${customer.phone})` : ''}`}></option>`)};
            </datalist>
        </div>
        <div class="col-6 col-sm">
            <label for="type" class="form-label">Тип на документ:</label>
            <select name="type" @change=${selectDocumentType} id="type" class="form-control" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}>
                ${Object.entries(params.documentTypes).map(type => html`<option ?selected=${(order && type[0] == order.type) || (!order && type[0] === documentType)} value=${type[0]}>${type[1]}</option>`)}
            </select>
        </div>
        <div class="col-6 col-sm">
            <label for="date" class="form-label">Дата:</label>
            <input type="date" name="date" id="date" class="form-control" ?disabled=${!['manager', 'admin'].includes(loggedInUser.role)} required>
        </div>
        <div class="col-6 col-sm">
            <label for="taxEventDate" class="form-label">Дата на данъчно събитие:</label>
            <input type="date" name="taxEventDate" id="taxEventDate" class="form-control" ?disabled=${!['manager', 'admin'].includes(loggedInUser.role)} required>
        </div>
        <div class="col-6 col-sm">
            <label for="number" class="form-label">Документ номер:</label>
            <input type="text" name="number" id="number" inputmode="numeric" class="form-control" autocomplete="off" ?readonly=${loggedInUser?.role !== 'admin'} value=${order ? pad(order.number, 0, 10) : pad(documentNumber, 0, 10)}>
        </div>
        <div class="col-6 col-sm">
            <label for="orderType" class="form-label">Тип на продажба:</label>
            <select ?disabled=${order} @change=${changeOrderType} name="orderType" id="orderType" class="form-control" required>
                ${Object.entries(params.orderTypes).map(type => html`<option ?selected=${(order && type[0] == order.orderType) || (!order && type[0] === defaultValues.find(d => d.key === 'orderType').value)} value=${type[0]}>${type[1]}</option>`)}
            </select>
        </div>
        <div class="col-6 col-sm">
            <button @click=${setDiscount} type="button" class="btn btn-secondary" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}>Задай обща отстъпка</button>
        </div>
`;

const secondTopRow = () => html`
    <div class="col-6 col-sm-3">
        <label for="creditForNumber" class="form-label">Към документ номер:</label>
        <input ?required=${documentType === 'credit' || order?.type === 'credit'} type="text" name="creditForNumber" id="creditForNumber" inputmode="numeric" class="form-control" autocomplete="off" ?readonly=${order && !['manager', 'admin'].includes(loggedInUser.role)} value=${order && order.type === 'credit' ? pad(order.creditForNumber, 0, 10) : ''}>
    </div>
    <div class="col-6 col-sm-3">
        <label for="creditFromDate" class="form-label">От дата:</label>
        <input ?required=${documentType === 'credit' || order?.type === 'credit'} type="date" name="creditFromDate" id="creditFromDate" class="form-control" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required>
    </div>
    <div class="col-6 col-sm-3">
        <div class="form-check form-switch p-0">
            <label class="form-check-label d-block" for="returnQuantity">Върни бройки в склад:</label>
            <input class="form-check-input ms-0 fs-4" type="checkbox" role="switch" id="returnQuantity" ?checked=${order?.returnQuantity || true} name="returnQuantity">
        </div>
    </div>
`;

const senderTemplate = (senders) => html`
    <label for="sender" class="form-label">Предал:</label>
    <input list="sendersList" class="form-control" name="sender" id="sender" type="text" .value=${senders?.slice(-1)[0] || ''} ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} autocomplete="off" required/>
    <datalist id="sendersList">
        ${selectedCompany && selectedCompany?.senders?.map(sender => html`<option value=${sender}></option>`)}
    </datalist>
`;

const receiverTemplate = (receivers) => html`
    <label for="receiver" class="form-label">Получил:</label>
    <input list="receiversList" class="form-control" name="receiver" id="receiver" type="text" .value=${receivers?.slice(-1)[0] || ''} autocomplete="off" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required/>
    <datalist id="receiversList">
        ${receivers?.map(receiver => html`<option value=${receiver}></option>`)}
    </datalist>
`;

const bottomRow = (params, companies) => html`
<div class="row g-3 align-items-end">
    <div class="col-6 col-sm">
        <label for="company" class="form-label">Обект:</label>
        <select @change=${selectCompany} name="company" id="company" class="form-control" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required>
            ${companies && companies.map(company => html`<option ?selected=${order && company._id == order.company._id || selectedCompany?._id == company._id} value=${company._id}>${company.name}</option>`)}
        </select>
    </div>

    <div id="receiverDiv" class="col-6 col-sm"></div>

    <div id="senderDiv" class="col-6 col-sm"></div>

    <div class="col-6 col-sm">
        <label for="paymentType" class="form-label">Начин на плащане:</label>
        <select name="paymentType" id="paymentType" class="form-control" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} required>
            ${Object.entries(params.paymentTypes).map(type => html`<option ?selected=${(order && type[0] == order.paymentType) || (!order && type[0] === defaultValues.find(d => d.key === 'paymentType').value)} value=${type[0]}>${type[1]}</option>`)}
        </select>
    </div>

    <div class="col-12 col-sm ${loggedInUser.role === 'admin' ? '' : 'd-none'}">
        <label for="paidAmount" class="form-label">Платена сума:</label>
        <div class="input-group">
            <input class="form-control" name="paidAmount" id="paidAmount" type="text" .value=${order ? order.paidAmount : 0} autocomplete="off" inputmode="decimal" required ?disabled=${loggedInUser.role !== 'admin'}/>

            ${order ? html`<button type="button" class="btn btn-secondary" data-bs-toggle="modal" data-bs-target="#paidHistoryModal">
                <i class="bi bi-clock-history"></i>
            </button>` : ''}
        </div>

        <div class="modal fade" id="paidHistoryModal" tabindex="-1" aria-labelledby="paidHistoryModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="paidHistoryModalLabel">История на плащанията</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Сума</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order?.paidHistory?.map(payment => html`<tr>
                                <td>${formatDate(payment.date)}</td>
                                <td>${formatPrice(payment.amount)}</td>
                            </tr>`)}
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary">Save changes</button>
                </div>
                </div>
            </div>
        </div>
    </div>

    ${documentType === 'invoice' ? html`
        <div class="col-12 col-sm">
        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="printCopy" ?checked=${['originalCopy', 'originalCopyStokova'].includes(defaultValues.find(d => d.key === 'orderPrint').value)}>
            <label class="form-check-label" for="printCopy">
                Копие на фактура
            </label>
        </div>

        <div class="form-check">
            <input class="form-check-input" type="checkbox" id="printStokova" ?checked=${'originalCopyStokova' === defaultValues.find(d => d.key === 'orderPrint').value}>
            <label class="form-check-label" for="printStokova">
                Стокова разписка
            </label>
        </div>
    </div>` : ''}

    <div class="col-12 col-sm text-center">
        <div >Общо: <span id="total"></span></div>
        <div class="d-flex gap-3">
            ${order?.deleted ? '' : submitBtn({ func: createEditOrder, text: "Запази", type: "button" })}
            ${order?.deleted ? '' : submitBtn({ func: createEditOrder, id: "submitWithPrint", text: "Запази и принтирай", type: "button" })}
            ${order?.deleted ? '' : submitBtn({ func: () => printSale(order), classes: "btn-danger", id: "print", text: "Само Принт", type: "button" })}
        </div>
    </div>
</div>
<div class="row mt-3">
    <div class="col-12 col-sm">
        <label for="notes" class="form-label">Основание:</label>
        <textarea  name="notes" id="notes" class="form-control" rows="3" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}>${order ? order.notes : ''}</textarea>
    </div>
</div>
`;

const speedyTemplate = () => html`
    <div>Доставка до: ${order.woocommerce.speedy.office ? "Офис" : "Адрес"}</div>
    <div>Държава: ${order.woocommerce.speedy.country}</div>
    <div>Град: ${order.woocommerce.speedy.locality}</div>
    ${order.woocommerce.speedy.office ? html`<div>Офис: ${order.woocommerce.speedy.office}</div>` : ''}
    ${order.woocommerce.speedy.street ? html`
        <div>Улица: ${order.woocommerce.speedy.street} ${order.woocommerce.speedy.number ? `№ ${order.woocommerce.speedy.number}` : ''} ${order.woocommerce.speedy.entrance ? `вх. ${order.woocommerce.speedy.entrance}` : ''} ${order.woocommerce.speedy.floor ? `ет. ${order.woocommerce.speedy.floor}` : ''} ${order.woocommerce.speedy.apartment ? `ап. ${order.woocommerce.speedy.apartment}` : ''}</div>
        ${order.woocommerce.speedy.note ? html`<div>Бележка: ${order.woocommerce.speedy.note}</div>` : ''}
` : ''}
    <div>Сума: ${formatPrice(order.woocommerce.speedy.total)}</div>
`;

const econtTemplate = () => html`
    <div>Доставка до: ${order.woocommerce.econt.ship_to}</div>
    <div>Град: ${order.woocommerce.econt.city}</div>
    <div>Пощенски код: ${order.woocommerce.econt.postal_code}</div>
    ${order.woocommerce.econt.office ? html`<div>${order.woocommerce.econt.office}</div>` : html`Адрес: ${order.woocommerce.econt.street} ${order.woocommerce.econt.number ? '№ ' + order.woocommerce.econt.number : ''} ${order.woocommerce.econt.entrance ? 'вх. ' + order.woocommerce.econt.entrance : ''} ${order.woocommerce.econt.floor ? 'ет. ' + order.woocommerce.econt.floor : ''} ${order.woocommerce.econt.apartment ? 'ап. ' + order.woocommerce.econt.apartment : ''}</div>`}
    <div>Сума: ${formatPrice(order.woocommerce.econt.total)}</div>
    ${order.woocommerce.econt.note ? html`<div>Бележка: ${order.woocommerce.econt.note}</div>` : ''}
`;

const shippingTemplate = () => html``;

const woocommerceTemplate = () => html`
    <!-- Status -->
    <div class="col-3">
        <label for="status" class="form-label">Статус:</label>
        <select name="status" id="status" class="form-control" required>
            ${Object.entries(params.woocommerce.status).map(type => html`<option ?selected=${order && type[0] == order.woocommerce.status} value=${type[0]}>${type[1]}</option>`)}
        </select>
    </div>

    <div class="col-3">
        <div>Доставка: ${order && (order.woocommerce.speedy?.total ? 'Speedy' : order.woocommerce.econt?.total ? 'Еконт' : order.woocommerce.shipping)}</div>
        ${order && order.woocommerce.speedy?.total ? speedyTemplate() : order && order.woocommerce.econt?.total ? econtTemplate() : shippingTemplate()}
    </div>
    <!-- TODO Add customer Note -->

    <!-- Alert -->
    <div class="${addedProducts.filter(p => !p?.product?.woocommerce).length ? '' : 'd-none'} alert alert-warning">Внимание! Въвели сте артикул, който не съществува в базата данни. Този артикул няма да се покаже в поръчката в онлайн магазина и сумата ще бъде различна от реалната. Предупредете клиента си за това.</div>
`;

function updateQuantity(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    if (e.target.value === '') return; // this is becacuse in credit document, if you enter "-" it changes value to null
    e.target.value = parseInt(e.target.value);

    if (orderType === 'wholesale') {
        if (order)
            addedProducts[arrayIndex].quantity = e.target.value;
        else if (e.target.max !== '' && +e.target.value > +e.target.max) {
            e.target.value = e.target.max;
            addedProducts[arrayIndex].quantity = e.target.max;
        }
        else
            addedProducts[arrayIndex].quantity = e.target.value;
    } else if (orderType === 'retail') {
        if (order) {
            addedProducts[arrayIndex].quantity = e.target.value;
        }
        else if (e.target.max !== '' && +e.target.value > +e.target.max) {
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

    if (orderType === 'retail' && !order) {// if order retail, compare current qty with newly selected size available qty
        const maxQtyForSize = addedProducts[arrayIndex].product?.sizes.find(s => s.size == addedProducts[arrayIndex].size).quantity
        addedProducts[arrayIndex].quantity = addedProducts[arrayIndex].quantity > maxQtyForSize ? parseInt(maxQtyForSize) : addedProducts[arrayIndex].quantity;
    }

    rerenderTable();
}

function updateVat(e) {
    const target = e.target;

    let value = target.value;

    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    value = target.value

    addedProducts[arrayIndex].vat = value;
    rerenderTable();
}

function updateDiscount(e) {
    const target = e.target;
    fixInputPrice({ target });
    let value = target.value;

    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    if (value > 100)
        target.value = 100;
    else if (value < 0)
        target.value = 0;

    value = target.value

    addedProducts[arrayIndex].discount = value;
    rerenderTable();
}

function updateDiscountSum(e) {
    const target = e.target;
    fixInputPrice({ target });
    let value = target.value;

    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    const originalPrice = Number(addedProducts[arrayIndex].price);

    if (value < 0)
        target.value = 0;
    else if (value > originalPrice)
        target.value = originalPrice;
    else if (isNaN(originalPrice))
        target.value = 0;

    value = Number(target.value);

    const discountedPrice = originalPrice - value;

    let discountPercent = 100 * ((originalPrice - discountedPrice) / originalPrice);

    if (isNaN(discountPercent)) discountPercent = 0;

    addedProducts[arrayIndex].discount = discountPercent;
    rerenderTable();
}

function updatePrice(e) {
    const target = e.target;
    fixInputPrice({ target, roundPrice: true });
    const value = target.value;

    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    addedProducts[arrayIndex].price = value;
    rerenderTable();
}

function updateUnitPrice(e) {
    const target = e.target;
    fixInputPrice({ target, roundPrice: true });
    const value = target.value;

    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    addedProducts[arrayIndex].price = +(value * ((addedProducts[arrayIndex].selectedSizes?.length || addedProducts[arrayIndex].qtyInPackage || 0) * (addedProducts[arrayIndex].multiplier || 1))).toFixed(2);
    rerenderTable();
}

function updateQtyInPackage(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    e.target.value ? addedProducts[arrayIndex].qtyInPackage = parseInt(e.target.value) : delete addedProducts[arrayIndex].qtyInPackage;
    rerenderTable();
}

function updateUnitOfMeasure(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    addedProducts[arrayIndex].unitOfMeasure = e.target.value;
    rerenderTable();
}

function removeProduct(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    addedProducts = addedProducts.filter(product => product.index != index);
    rerenderTable();
}

const addProductRow = () => html`
<tr id="addNewProduct">
    <td colspan="3">
        <div class="input-group">
            <input @keydown=${addProduct} @keyup=${addProduct} placeholder="Баркод/код" class="form-control" type="search" name="product" id="product" autocomplete="off" enterKeyHint="search">
            <!-- <button @click=${scanBarcode} class="btn btn-primary" type="button" id="scanBarcode"><i class="bi bi-camera"></i> Сканирай</button> -->
            <!-- <button @click=${stopBarcode} class="btn btn-primary d-none" type="button" id="stopBarcode"><i class="bi bi-camera"></i> Затвори</button> -->
        </div>
    </td>
    <td colspan="10">
        <!-- <div id="barcodeVideo"></div> -->
    </td>
</tr>
`;

function updateSelectedSizes(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    if (!e.target.checked) addedProducts[arrayIndex].selectedSizes = addedProducts[arrayIndex].selectedSizes.filter(size => size !== e.target.value);
    else addedProducts[arrayIndex].selectedSizes.push(e.target.value);

    // Update price based on selected sizes length
    if (addedProducts[arrayIndex].selectedSizes.length > 0) {
        const unitPrice = addedProducts[arrayIndex].product.wholesalePrice / (addedProducts[arrayIndex].product.sizes.length * addedProducts[arrayIndex].product.multiplier);
        addedProducts[arrayIndex].price = (unitPrice * addedProducts[arrayIndex].selectedSizes.length * addedProducts[arrayIndex].multiplier).toFixed(2);
    } else addedProducts[arrayIndex].price = 0;

    rerenderTable();
}

const checkboxSizes = (product) => html`
<div class="fw-bold text-center">${product.selectedSizes.length}</div>
    ${product?.product?.sizes?.map(size => html`
        <div class="form-check form-check-inline">
            <input class="form-check-input" @change=${updateSelectedSizes} name="${product.index}-${size.size}" type="checkbox" value=${size.size} ?checked=${product?.selectedSizes?.includes(size.size)} ?disabled=${!order && product.product.sizes.find(s => s.size === size.size).quantity === 0} id="${product.index}-${size.size}">
            <label class="form-check-label" for="${product.index}-${size.size}">
                ${size.size}
            </label>
        </div>`)
    }`;

function updateMultiplier(e) {
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));
    fixInputPrice({ target: e.target, int: true });
    addedProducts[arrayIndex].multiplier = parseInt(e.target.value);

    // Update price for package
    const unitPrice = addedProducts[arrayIndex].product.wholesalePrice / (addedProducts[arrayIndex].product.sizes.length * addedProducts[arrayIndex].product.multiplier);
    addedProducts[arrayIndex].price = (unitPrice * addedProducts[arrayIndex].selectedSizes.length * addedProducts[arrayIndex].multiplier).toFixed(2);

    rerenderTable();
}

function printLabels(e) {
    e.preventDefault();
    const index = e.target.closest('tr').getAttribute('addedProductsIndex');
    // find actual index in the array of addedProducts
    const arrayIndex = addedProducts.indexOf(addedProducts.find(product => product.index == index));

    const product = addedProducts[arrayIndex];
    socket.emit('send-print-orders', product);
}

const wholesaleProductsTable = (products) => html`
    <table id="orders" class="table mt-3 table-striped">
        <thead>
            <tr>
                <td>№</td>
                <th>Продукт</th>
                <th>Мярка</th>
                <th class="text-primary">Повтарящи бр. от размер</th>
                <th class="text-primary">Брой в пакет</th>
                <th>Цена за брой</th>
                <th class="text-primary">Количество</th>
                <th class="text-primary">Цена</th>
                <th>Отстъпка %</th>
                <th>Отстъпка лв.</th>
                <th>ДДС %</th>
                <th>Сума</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody class="table-group-divider">
            ${products?.map(product => html`
                <tr addedProductsIndex=${product.index}>
                    <td>${product.index + 1}</td>

                    <td>${product?.product?.name || product.name} ${product.product && '[#' + product.product.code + ']'}</td>

                    <td>${product?.product?.unitOfMeasure || html`<input @change=${updateUnitOfMeasure} type="text" class="form-control" required name="unitOfMeasure" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} .value=${product.unitOfMeasure}/>`}</td>

                    <td>
                        ${product?.product?.sizes?.length
        ? html`<input @change=${updateMultiplier} type="text" class="form-control" step="1" min="1" inputmode="numeric" required name="multiplier" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} .value=${product.multiplier}/>`
        : ''}</td>

                        ${product.product ?
        html`<td>${product.product.sizes.length ? checkboxSizes(product) : ''}</td>`
        : html`<td><input @change=${updateQtyInPackage} name="qtyInPackage" class= "form-control" .value=${product.qtyInPackage || ""} type="number" step="1" min="0" inputmode="numeric" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>`}

                        <td>${product?.product?.sizes?.length || !product?.product
        ? html`<input @keyup=${updateUnitPrice} name="unitPrice" class="form-control" type="text" .value=${product.selectedSizes?.length ? +(product.price / ((product.selectedSizes.length || 0) * product.multiplier)).toFixed(2) : product?.qtyInPackage ? +(product.price / product.qtyInPackage).toFixed(2) : ''} inputmode="decimal" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/>`
        : ''}</td>

                    <td>
                        <div class="input-group">
                            <input @change=${updateQuantity} @keyup=${updateQuantity} name="quantity" class="form-control" type="number" .value=${product.quantity} step="1" min=${order?.type === 'credit' || documentType === 'credit' ? '' : 1} inputmode="numeric" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/>
                            ${product?.product?.quantity ? html`<span class="input-group-text">/${product?.product?.quantity}</span>` : ''}
                        </div>
                    </td>

                    <td><input @change=${updatePrice} @keyup=${updatePrice} name="price" class="form-control" type="text" .value=${product.price} inputmode="decimal" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>

                    <td><input @change=${updateDiscount} @keyup=${updateDiscount} name="discount" class="form-control" type="text" inputmode="decimal" .value=${product.discount} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} /></td>

                    <td><input @change=${updateDiscountSum} @keyup=${updateDiscountSum} name="discountSum" class="form-control" type="text" inputmode="decimal" .value=${product.discount ? (product.price * product.discount / 100) : 0} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>

                    <td>
                        <select style="min-width: 60px" @change=${updateVat} name="vat" class="form-control">
                            <option ?selected=${product && product.vat === 0} value='0'>0%</option>
                            <option ?selected=${product && product.vat === 9} value='9'>9%</option>
                            <option ?selected=${!product || product?.vat === 20} value='20'>20%</option>
                        </select>
                    </td>

                    <td name="subtotal"  class="text-nowrap">${formatPrice((product.price * product.quantity) * (1 - product.discount / 100))}</td>

                    <td>
                        <div class="d-flex gap-1">
                            ${!product?.product ? html`<button @click=${printLabels} class="btn btn-primary" type="button" tabindex="-1"><i class="bi bi-upc"></i><span class="d-none d-sm-inline"></span></button>` : ''}
                            ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : html`<button @click=${removeProduct} type="button" class="btn btn-danger" tabindex="-1">X</button>`}
                        </div>
                    </td>
                </tr>
                `)}

            ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : addProductRow()}
        </tbody>
    </table>
`;

const retailProductsTable = (products) => html`
    <table class="table mt-3 table-striped">
        <thead>
            <tr>
                <td>№</td>
                <th>Продукт</th>
                <th>Размер</th>
                <th>Мярка</th>
                <th>Количество</th>
                <th>Цена</th>
                <th>Отстъпка %</th>
                <th>ДДС %</th>
                <th>Сума</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody>
            ${products?.map(product => html`
                <tr addedProductsIndex=${product.index}>
                    <td>${product.index + 1}</td>

                    <td>${product?.product?.name || product.name} ${product.product && '[#' + product.product.code + ']'}</td>

                    <td>
                        ${product.product && product.product.sizes.length ? html`
                            <select @change=${updateSize} name="size" class="form-control" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}>
                                <option ?selected=${!product?.size} disabled>Избери</option>
                                ${product.product.sizes.map(size => html`<option value=${size.size} ?selected=${size.size === product.size} ?disabled=${size.quantity < 1}>${size.size}</option>`)}
                            </select>` : product.product ? '' : html`<input @change=${updateSize} name="size" class="form-control" type="text" .value=${product?.size || ''} ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} />`}
                    </td>


                    <td>${product?.product?.unitOfMeasure === 'пакет' ? ' бр.' : product?.product?.unitOfMeasure || html`<input @change=${updateUnitOfMeasure} type="text" class="form-control" required name="unitOfMeasure" ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)} .value=${product.unitOfMeasure}/>`}</td>

                    <td>
                        <div class="input-group">
                            <input @change=${updateQuantity} name="quantity" class="form-control" type="number" .value=${product.quantity} step="1" min="1" inputmode="numeric" .max=${!order && product.size && product?.product?.sizes?.find(s => s.size == product.size)?.quantity}  required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/>
                            <span class="input-group-text" id="basic-addon2">/${product.size ? product?.product?.sizes.find(s => s.size == product.size)?.quantity : product?.product?.quantity || ''}</span>
                        </div >
                    </td >

                    <td><input @change=${updatePrice} name="price" class="form-control" type="text" .value=${product.price} inputmode="decimal" required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>

                    <td><input @change=${updateDiscount} name="discount" class="form-control" type="number" step="0.1" inputmode="numeric" .value=${product.discount} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>

                    <td><input @change=${updateDiscountSum} @keyup=${updateDiscountSum} name="discountSum" class="form-control" type="text" inputmode="decimal" .value=${product.discount ? (product.price * product.discount / 100) : 0} required ?disabled=${order && !['manager', 'admin'].includes(loggedInUser.role)}/></td>

                    <td>
                        <select style="min-width: 60px" @change=${updateVat} name="vat" class="form-control" ?disabled=${product?.product && product.vat}>
                            <option ?selected=${product && product.vat === 0} value='0'>0%</option>
                            <option ?selected=${product && product.vat === 9} value='9'>9%</option>
                            <option ?selected=${!product || product?.vat === 20} value='20'>20%</option>
                        </select >
                    </td >

                    <td name="subtotal">${formatPrice((product.price * product.quantity) * (1 - product.discount / 100))}</td>

                    <td>
                        ${order && !['manager', 'admin'].includes(loggedInUser.role) ? '' : html`<button @click=${removeProduct} type="button" class="btn btn-danger">X</button>`}</td>
                </tr > `)}
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

async function addProduct(e) {
    if (e.target.value === '') return;

    if (e.type === 'keyup' && (!e.ctrlKey && e.key !== 'v') && (!e.metaKey && e.key !== 'v')) return;

    // return if not any of the key combinations below (CTRL+V, MAC+V, ENTER, NUM ENTER)
    if (e.type === 'keydown' && e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.key !== 'Enter') return;

    e.preventDefault();

    var product, quantity = 1;

    // check if quantity was entered in input field
    if (e.target.value.split('*').length === 1)
        product = e.target.value;
    else {
        quantity = parseInt(e.target.value.split('*')[0]);
        quantity = !isNaN(quantity) ? quantity : 1;
        product = e.target.value.split('*')[1];
    }

    e.target.value = ''

    // check if product exists in db by code, barcode (13 digit) or barcode (minus the first digit because its skipped by the scanner)
    // make a query to get the product from db
    const res = await axios.get('/products/find', { params: { search: product, filter: { deleted: false } } });
    const productInDB = res.data || null;

    const productVat = selectedCompany.tax === 0 ? 0 : productInDB?.vat || 20;

    // Wholesale + IN DB + variable
    if (orderType === 'wholesale' && productInDB && productInDB.sizes?.length > 0) {
        // Check if already in addedProducts and if all sizes are selected
        const inArray = false;
        // const inArray = addedProducts.find(p => p.product?._id === productInDB._id && p?.selectedSizes.length === p?.product?.sizes.length);

        if (inArray) inArray.quantity = +inArray.quantity + quantity;
        else {
            const temp = {
                index: addedProductsIndex++,
                product: productInDB,
                selectedSizes: productInDB.sizes.filter(s => s.quantity > 0).map(s => s.size), // selected (checked) sizes
                sizes: productInDB.sizes.map(s => s.size), // all available sizes to select
                quantity: quantity > productInDB.quantity ? productInDB.quantity || 1 : quantity, // if qty in db is 0, set to 1. if qty is more than in db, set it as max
                originalVat: productInDB?.vat,
                vat: productVat,
                price: productInDB.saleWholesalePrice || productInDB.wholesalePrice,
                unitPrice: (productInDB.saleWholesalePrice || productInDB.wholesalePrice) / (productInDB.sizes.length * productInDB.multiplier), // only used to display the price per unit in column
                discount: selectedCustomer?.discount || 0,
                multiplier: productInDB.multiplier,
                unitOfMeasure: productInDB.unitOfMeasure
            };

            if (temp.selectedSizes.length !== productInDB.sizes.length) {
                const unitPrice = (productInDB.saleWholesalePrice || productInDB.wholesalePrice) / (productInDB.sizes.length * productInDB.multiplier);
                temp.price = (unitPrice * temp.selectedSizes.length).toFixed(2);
            }

            addedProducts.push(temp);
        }
    }
    // Wholesale + IN DB + simple
    else if (orderType === 'wholesale' && productInDB && productInDB.sizes?.length === 0) {
        const inArray = false;
        // const inArray = addedProducts.find(p => p.product?._id === productInDB._id);
        // Check if product is already in addedProducts
        if (inArray) {
            inArray.quantity = +inArray.quantity + quantity;
            // if qty is more than in db, set it as max
            if (inArray.quantity > productInDB.quantity)
                inArray.quantity = productInDB.quantity;
        }
        else
            addedProducts.push({
                index: addedProductsIndex++,
                product: productInDB,
                unitOfMeasure: productInDB.unitOfMeasure,
                quantity: quantity > productInDB.quantity ? productInDB.quantity : quantity,
                originalVat: productInDB?.vat,
                vat: productVat,
                price: productInDB.saleWholesalePrice || productInDB.wholesalePrice,
                discount: selectedCustomer?.discount || 0
            });
    }

    // Retail + IN DB + variable
    else if (orderType === 'retail' && productInDB && productInDB.sizes?.length > 0) {
        const inArray = false;
        // const inArray = addedProducts.find(p => p.product?._id === productInDB._id && !p.size);
        // Check if already in addedProducts and NO size is selected
        if (inArray) {
            inArray.quantity = +inArray.quantity + quantity;
        } else
            addedProducts.push({
                index: addedProductsIndex++,
                product: productInDB,
                unitOfMeasure: productInDB.unitOfMeasure,
                quantity,
                originalVat: productInDB?.vat,
                vat: productVat,
                price: productInDB.retailPrice,
                discount: selectedCustomer?.discount || 0
            });
    }

    // Retail + IN DB + simple
    else if (orderType === 'retail' && productInDB && productInDB.sizes?.length === 0) {
        const inArray = false;
        // const inArray = addedProducts.find(p => p.product?._id === productInDB._id);
        // Check if already in addedProducts
        if (inArray) {
            inArray.quantity = +inArray.quantity + quantity;
            // if qty is more than qty in db, set it as max
            if (inArray.quantity > productInDB.quantity)
                inArray.quantity = productInDB.quantity;
        }
        else
            addedProducts.push({
                index: addedProductsIndex++,
                product: productInDB,
                quantity: quantity > productInDB.quantity ? productInDB.quantity : quantity,
                price: productInDB.retailPrice,
                vat: productVat,
                unitOfMeasure: productInDB.unitOfMeasure === 'пакет' ? 'бр.' : productInDB.unitOfMeasure,
                discount: selectedCustomer?.discount || 0
            });
    }

    // Wholesale and NOT in DB
    else if (orderType === 'wholesale' && !productInDB)
        addedProducts.push({
            index: addedProductsIndex++,
            name: product,
            quantity,
            price: 0,
            originalVat: productVat,
            vat: productVat,
            qtyInPackage: 0,
            unitOfMeasure: 'пакет',
            discount: selectedCustomer?.discount || 0
        });

    // Retail and NOT in DB
    else if (orderType === 'retail' && !productInDB)
        addedProducts.push({
            index: addedProductsIndex++,
            name: product,
            quantity,
            price: 0,
            originalVat: productVat,
            vat: productVat,
            unitOfMeasure: 'бр.',
            discount: selectedCustomer?.discount || 0
        });

    successScan(e.target);
    rerenderTable();

    e.target.value = '';

    // Focus on the quantity field of the newly added product
    const newlyAddedProductRow = document.querySelector(`tr[addedProductsIndex="${addedProductsIndex - 1}"]`);
    if (newlyAddedProductRow) {
        const quantityInput = newlyAddedProductRow.querySelector('input[name="qtyInPackage"]');
        if (quantityInput) quantityInput.focus();
    }

    // Focus back the barcode input field
    // e.target.focus();
    // scroll to button
    e.target.scrollIntoView({ behavior: 'smooth' });
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

    if (data.type === 'credit' && !data.creditForNumber) {
        markInvalid('creditForNumber');
        invalidFlag = true;
    } else markValid('creditForNumber');

    if (data.type === 'credit' && !data.creditFromDate) {
        markInvalid('creditFromDate');
        invalidFlag = true;
    } else markValid('creditFromDate');

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

        // Variable existing product
        if (orderType === 'wholesale' && product.product && product.selectedSizes?.length === 0) {
            // atleast 1 size must be selected
            row.querySelectorAll('input[name="size"]').forEach(el => {
                markInvalidEl(el);
            });

            invalidFlag = true;
        } else {
            row.querySelectorAll('select[name="size"]').forEach(el => {
                markValidEl(el);
            });
        }

        if (product.product && orderType === 'retail') {
            const sizeEl = row.querySelector('select[name="size"]');

            if (sizeEl && !product.size) {
                markInvalidEl(sizeEl);
                invalidFlag = true;
            } else if (sizeEl && product.size) markValidEl(sizeEl);
        }

        if (!product.quantity || product.quantity < 1) {
            markInvalidEl(row.querySelector('input[name="quantity"]'));
            invalidFlag = true;
        } else markValidEl(row.querySelector('input[name="quantity"]'));

        if (isNaN(product.discount) || product.discount < 0 || product.discount > 100) {
            markInvalidEl(row.querySelector('input[name="discount"]'));
            invalidFlag = true;
        } else markValidEl(row.querySelector('input[name="discount"]'));

        if (!product.price || product.price < 0.01 || !priceRegex.test(product.price)) {
            markInvalidEl(row.querySelector('input[name="price"]'));
            invalidFlag = true;
        } else markValidEl(row.querySelector('input[name="price"]'));

        // Only check if quantity exists on retail or wholesale but product is simple
        if (orderType === 'retail' || (orderType === 'wholesale' && !row.querySelector('input[name="size"]'))) {
            if (!product.quantity || product.quantity < 1) {
                markInvalidEl(row.querySelector('input[name="quantity"]'));
                invalidFlag = true;
            } else markValidEl(row.querySelector('input[name="quantity"]'));
        }

        if (!product.unitOfMeasure) {
            markInvalidEl(row.querySelector('input[name="unitOfMeasure"]'));
            invalidFlag = true;
        } else if (product.unitOfMeasure && !product.product) markValidEl(row.querySelector('input[name="unitOfMeasure"]'));
    });

    return invalidFlag;
}

async function createEditOrder(e) {
    if (order && !['manager', 'admin'].includes(loggedInUser.role)) // normal user editing, just print because they cant edit anything
        return printSale(order);

    toggleSubmitBtn(e.target);

    const form = document.querySelector('form');
    var filteredProducts = [];

    // transform addedProducts to the type used in backend
    if (orderType === 'wholesale') {
        addedProducts.forEach(product => {
            product.discount = product.discount || 0;
            if (product.product) {
                // Variable Product
                if (product.selectedSizes?.length > 0) {
                    filteredProducts.push({
                        index: product.index,
                        product: product.product._id,
                        quantity: product.quantity,
                        price: product.price,
                        vat: product.vat,
                        discount: product.discount,
                        selectedSizes: product.selectedSizes,
                        unitOfMeasure: product.product.unitOfMeasure,
                        multiplier: product.multiplier
                    });
                }

                // Simple product
                if (!product.selectedSizes?.length)
                    filteredProducts.push({
                        index: product.index,
                        product: product.product._id,
                        quantity: product.quantity,
                        vat: product.vat,
                        price: product.price,
                        discount: product.discount,
                        unitOfMeasure: product.product.unitOfMeasure
                    });
            }
            else
                filteredProducts.push({
                    index: product.index,
                    name: product.name,
                    quantity: product.quantity,
                    vat: product.vat,
                    price: product.price,
                    ...(product.qtyInPackage > 0 && { qtyInPackage: product.qtyInPackage }),
                    discount: product.discount,
                    unitOfMeasure: product.unitOfMeasure
                });
        });
    } else if (orderType === 'retail') {
        addedProducts.forEach(product => {
            product.discount = product.discount || 0;
            if (product.product)
                filteredProducts.push({
                    index: product.index,
                    product: product.product._id,
                    quantity: product.quantity,
                    vat: product.vat,
                    price: product.price,
                    ...(product.size && { size: product.size }),
                    discount: product.discount,
                    unitOfMeasure: product.unitOfMeasure
                });
            else
                filteredProducts.push({
                    index: product.index,
                    name: product.name,
                    quantity: product.quantity,
                    vat: product.vat,
                    price: product.price,
                    size: product.size,
                    discount: product.discount,
                    unitOfMeasure: product.unitOfMeasure
                });
        });
    }

    const data = {
        number: document.getElementById('number').value,
        date: document.getElementById('date').value,
        taxEventDate: document.getElementById('taxEventDate').value,
        type: document.getElementById('type').value,
        customer: selectedCustomer?._id,
        orderType: document.getElementById('orderType').value,
        products: filteredProducts,
        paymentType: document.getElementById('paymentType').value,
        paidAmount: +(document.getElementById('paidAmount').value.replace(',', '.')),
        company: document.getElementById('company').value,
        receiver: document.getElementById('receiver').value,
        sender: document.getElementById('sender').value,
        notes: document.getElementById('notes').value,
    };

    if (data.type === 'credit') {
        data.creditForNumber = document.getElementById('creditForNumber').value;
        data.creditFromDate = document.getElementById('creditFromDate').value;
        data.returnQuantity = document.getElementById('returnQuantity').checked;
    }

    if (order && order.woocommerce) {
        const wooStatus = document.getElementById('status');
        data.woocommerce = {
            status: wooStatus.value,
        }
    }

    const invalidData = validateOrder(data);

    if (invalidData) {
        form.classList.remove('was-validated');
        return toggleSubmitBtn(e.target);
    }

    form.classList.add('was-validated');
    form.classList.remove('needs-validation')

    const alertEl = document.getElementById('alert');
    try {
        const req = order ? await axios({
            method: 'put',
            url: `/orders/${order._id}`,
            timeout: 1200000,
            data: data,
        }) : await axios({
            method: 'post',
            url: '/orders',
            timeout: 1200000,
            data: data
        }, data);

        if (req.status === 201) {
            toggleSubmitBtn(e.target);

            if (e.target.id === 'submitWithPrint')
                return page(`/orders/${req.data}?print`);

            page('/orders/create')
        }
    } catch (err) {
        toggleSubmitBtn(e.target);
        console.error(err);
        if (err.response.status === 400 || err.response.status === 409) {
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
    if (!data) return;
    const printCopy = document.getElementById('printCopy')?.checked || false;
    const printStokova = document.getElementById('printStokova')?.checked || false;
    let flags = {};
    isMobileDevice = window.screen.width <= 1024;

    // Check if any product has discount, if none - dont show column
    flags.tableShowDiscounts = data.products.some(product => product.discount > 0);

    if (flags.tableShowDiscounts === true) {
        // Calculate discount total
        let discountTotal = 0;
        data.products.forEach(product => {
            if (product.discount > 0) {
                discountTotal += product.quantity * product.price * (product.discount / 100);
            }
        });
        flags.discountTotal = discountTotal;
    }

    // Check if any product has qtyInPackage, if none - dont show column
    flags.tableShowQtyInPackage = data.products.some(product => product.qtyInPackage > 0);

    // Check if any product has size, if none - dont show column
    flags.tableShowSizes = data.products.some(product => product.size);

    // Check if company is vat exempt
    flags.noVat = selectedCompany.tax == 0;

    if (flags.noVat) {
        data.products.forEach(product => {
            product.vat = 0;
        })
    }

    // Calculate totals for different VATS (ex some products have 20% vat, some have 9%)
    const totals = calculateTotalVats(data.products);

    // should print something like this: invoice original, invoice copy, etc etc depending on whats selected as type
    const printPages = [];
    printPages.push(printContainer({ totals, data, flags }));
    if (printCopy === true) // print a copy of the invoice
        printPages.push(printContainer({ totals, data, param: { copy: true }, flags }));

    if (printStokova === true) // print stokova of the invoice
        printPages.push(printContainer({ totals, data, param: { stokova: true }, flags }));

    const container = document.getElementById('printContainer');

    render(printPages, container);

    if (!isMobileDevice) {
        if (data.type === 'stokova' || printStokova === true) {
            document.getElementById('rate-us-qr').classList.add('d-print-block');
        } else {
            document.getElementById('rate-us-qr').classList.remove('d-print-block');
        }
    }

    try {
        if (!document.execCommand('print', false, null)) {
            window.print();
        }
    } catch {
        window.print();
    }
}

// invoice should have deducted tax in product price and shown as sum at the end
// stokova should have all products with tax included in price and shown as sum at the end
const printContainer = ({ totals, data, param, flags }) => html`
    <div style="${data.type === 'stokova' || param?.stokova ? '' : 'break-after:page;'} padding: 1rem; color: black !important;">
        <h1 class="text-center fw-bold">${param?.stokova ? 'Стокова разписка' : params.documentTypes[data.type]}</h1>
        <div class="text-center fs-5">${param?.copy ? 'Копие' : 'Оригинал'}</div>
        <div class="d-flex justify-content-between">
            <div>
                ${param?.stokova ? '' : html`<div>Документ №: <span class="fw-bold">${pad(data.number, 0, 10)}</span></div>`}
                ${data?.type === 'credit' ? html`<div>Към документ №: <span class="fw-bold">${data.creditForNumber}</span></div><div>От дата: <span class="fw-bold">${new Date(data.creditFromDate).toLocaleDateString('bg')}</span></div>` : ''}

            </div>
            <div>Дата: <span class="fw-bold">${new Date(data.date).toLocaleDateString('bg')}</span></div>
        </div>

        <div class="${isMobileDevice ? 'column' : 'row'} gap-3 p-1">
            <table id="customerInfoTable" class="col border rounded ${isMobileDevice ? 'w-100' : ''}">
                <tbody>
                    <tr><td>Получател</td> <td>${data.customer.name}</td></tr>
                    <tr>${data.customer?.taxvat ? html`<td>ДДС №</td> <td>${data.customer.taxvat}</td>` : ''}</tr>
                    <tr><td>Идент. № <td>${data.customer.vat}</td></tr>
                    <tr><td>Адрес</td> <td>${data.customer.address}</td></tr>
                    <tr><td>МОЛ</td> <td>${data.customer.mol}</td></tr>
                    ${data.customer?.phone ? html`<tr><td>Телефон</td> <td>${data.customer.phone}</td></tr>` : ''}
                </tbody>
            </table>

            <table id="companyInfoTable" class="col border rounded ${isMobileDevice ? 'w-100' : ''}">
                <tbody>
                    <tr><td>Доставчик</td> <td>${data.company.name}</td></tr>
                    <tr>${data.company?.taxvat ? html`<td>ДДС №</td> <td>${data.company.taxvat}</td>` : ''}</tr>
                    <tr><td>Идент. № <td>${data.company.vat}</td></tr>
                    <tr><td>Адрес</td> <td>${data.company.address}</td></tr>
                    <tr><td>МОЛ</td> <td>${data.company.mol}</td></tr>
                    ${data.company?.phone ? html`<tr><td>Телефон</td> <td>${data.company.phone}</td></tr>` : ''}
                </tbody>
            </table>
        </div>

        ${data.orderType === 'wholesale' ? printTableWholesale({ products: data.products, type: param?.stokova ? 'stokova' : data.type, flags }) : printTableRetail({ products: data.products, type: param?.stokova ? 'stokova' : data.type, flags })}
        <div style="font-size: 1rem">
            Словом: ${numberToBGText(data.total)}
        </div>

        <div class="d-flex flex-column text-end">
            ${param?.stokova || data.type === 'stokova' ? '' : flags.noVat ? html`
                <div>Данъчна основа: ${formatPrice(totals[0])} / ${formatPrice(BGNtoEuro(totals[0]), true)}</div>
                <div>ДДС: ${formatPrice(0)} / ${formatPrice(BGNtoEuro(0), true)}</div>
            ` : Object.keys(totals).map(key => html`
                <div>Данъчна основа ${key}%: ${formatPrice(deductVat(totals[key], Number(key)))} / ${formatPrice(BGNtoEuro(deductVat(totals[key], Number(key))), true)}</div>
                <div>ДДС ${key}%: ${formatPrice(totals[key] - deductVat(totals[key], Number(key)))} / ${formatPrice(BGNtoEuro(totals[key] - deductVat(totals[key], Number(key))), true)}</div>
            `)}

            ${(param?.stokova || data.type === 'stokova') && flags.tableShowDiscounts ? html`<div style="font-size: 0.8rem">Сума преди остъпка: ${formatPrice(data.total + flags.discountTotal)} / ${formatPrice(BGNtoEuro(data.total + flags.discountTotal), true)}</div>` : ''}
            ${(param?.stokova || data.type === 'stokova') && flags.tableShowDiscounts ? html`<div style="font-size: 0.8rem">Отстъпка: ${formatPrice(flags.discountTotal)} / ${formatPrice(BGNtoEuro(flags.discountTotal), true)}</div>` : ''}
            <div class="fw-bold">Сума за плащане: ${formatPrice(data.total)} / ${formatPrice(BGNtoEuro(data.total), true)}</div>
        </div>

        <div class="mt-3">
            ${data.notes ? html`<div>Основание: ${data.notes}</div>` : ''}
            <div>Плащане: ${params.paymentTypes[data.paymentType]}</div>
            ${data.paymentType === 'bank' ? html`
                <div>IBAN: ${data.company.bank.iban}</div>
                <div>Банка: ${data.company.bank.name}</div>
                <div>Банков код: ${data.company.bank.code}</div>` : ''}
        </div>
        <div>Дата на данъчно събитие: ${new Date(data.taxEventDate).toLocaleDateString('bg')}</div>
        <div class="d-flex justify-content-between">
            <div>Получил: ${data.receiver}</div>
            <div>Съставил: ${data.sender}</div>
        </div>

        ${(param?.stokova === true || data.type === 'stokova') && data.customer.deliveryAddress ? html`
            <div>
                <span>Адрес за доставка: ${data.customer.deliveryAddress}</span>
            </div>` : ''}
    </div >
    `;

const printTableWholesale = ({ products, type, flags }) => html`
    <table id="printProductWholesaleTable" class="table table-bordered table-striped">
        <thead>
            <tr class="fw-bold text-center">
                ${isMobileDevice ? '' : html`<td>Ред</td>`}
                <td>Код</td>
                <td>Стока</td>
                ${isMobileDevice && type === 'stokova' ? '' : html`<td>Мярка</td>`}
                <td>Пакети</td>
                ${isMobileDevice && type !== 'stokova' ? '' : html`<td>Брой в пакет</td>`}
                ${isMobileDevice && type !== 'stokova' ? '' : html`<td>${flags.tableShowDiscounts ? 'Цена за брой след ТО%' : 'Цена за брой'}</td>`}
                ${isMobileDevice && (type === 'stokova' || flags.tableShowDiscounts) ? '' : html`<td>Цена</td>`}
                ${!isMobileDevice && flags.tableShowDiscounts ? html`<td>Отстъпка</td>` : ''}
                ${flags.tableShowDiscounts ? isMobileDevice && type === 'stokova' ? '' : html`<td>Цена след ТО%</td>` : ''}
                ${type === 'stokova' || flags.noVat ? '' : html`<td>ДДС</td>`}
                <td>Сума</td>
            </tr>
        </thead>
        <tbody class="table-group-divider">
            ${products.map((product, index) => html`
                <tr class="text-center">
                    ${isMobileDevice ? '' : html`<td>${index + 1}</td>`}
                    <td .field="code">${product?.product?.code || ''}</td>

                    <td .field="name">${product?.product?.name || product.name}</td>

                    ${isMobileDevice && type === 'stokova' ? '' : html`<td .field="unitOfMeasure">${product?.product?.unitOfMeasure || product.unitOfMeasure}</td>`}

                    <td .field="quantity" class="text-nowrap">${product.quantity}</td>

                    ${isMobileDevice && type !== 'stokova' ? '' : html`<td .field="qtyInPackage">${product?.selectedSizes?.length ? product.selectedSizes.length * product.multiplier : product.qtyInPackage}</td>`}

                    ${isMobileDevice && type !== 'stokova' ? '' : html`<td .field="piecePrice">${product.qtyInPackage || product?.selectedSizes?.length ? formatPriceNoCurrency(type === 'stokova' ? (product.price / (product?.selectedSizes?.length ? product.selectedSizes.length * product.multiplier : product.qtyInPackage) * (1 - product.discount / 100)) : deductVat((product.price / (product?.selectedSizes?.length || product.qtyInPackage) * (1 - product.discount / 100)), product.vat)) : isMobileDevice && type === 'stokova' ? formatPriceNoCurrency(product.price * (1 - product.discount / 100)) : ''}</td>`}

                    ${isMobileDevice && (type === 'stokova' || flags.tableShowDiscounts) ? '' : html`<td .field="price" class="text-nowrap">${formatPriceNoCurrency(type === 'stokova' ? product.price : deductVat(product.price, product.vat))}</td>`}

                    ${!isMobileDevice && flags.tableShowDiscounts ? html`<td .field="discountPercent">${product?.discount > 0 ? product.discount + '%' : '0%'}</td>` : ''}

                    ${flags.tableShowDiscounts ? isMobileDevice && type === 'stokova' ? '' : html`<td .field="discountPrice" class="text-nowrap">${product?.discount ? formatPriceNoCurrency(type === 'stokova' ? product.price * (1 - product.discount / 100) : deductVat(product.price * (1 - product.discount / 100), product.vat)) : formatPriceNoCurrency(type === 'stokova' ? product.price : deductVat(product.price, product.vat))}</td>` : ''}

                    ${type === 'stokova' || flags.noVat ? '' : html`<td .field="vat" class="text-nowrap">${product.vat}%</td>`}

                    <td .field="sum" class="text-nowrap">${formatPriceNoCurrency(type === 'stokova' ? ((product.price * product.quantity) * (1 - product.discount / 100)) : deductVat((product.price * product.quantity) * (1 - product.discount / 100), product.vat))}</td>
                </tr>
            `)}
        </tbody>
    </table >
    `;

// Add same styling as wholesale table
const printTableRetail = ({ products, type, flags }) => html`
    <table id="printProductRetailTable" class="table table-bordered table-striped">
        <thead>
            <tr class="fw-bold text-center">
                ${isMobileDevice ? '' : html`<td>Ред</td>`}
                <td>Код</td>
                <td>Стока</td>
                ${isMobileDevice && type === 'stokova' ? '' : html`<td>Мярка</td>`}
                ${!isMobileDevice && flags.tableShowSizes ? html`<td>Размер</td>` : ''}
                <td>Брой</td>
                ${isMobileDevice && type === 'stokova' && flags.tableShowDiscounts ? '' : html`<td>Цена</td>`}
                ${flags.tableShowDiscounts ? isMobileDevice && type === 'stokova' ? '' : html`<td>Отстъпка</td>` : ''}
                ${flags.tableShowDiscounts ? html`<td>Цена след ТО%</td>` : ''}
                ${type === 'stokova' || flags.noVat ? '' : html`<td>ДДС</td>`}
                <td>Сума</td>
            </tr>
        </thead>
        <tbody class="table-group-divider">
            ${products.map((product, index) => html`
                <tr class="text-center">
                    ${isMobileDevice ? '' : html`<td>${index + 1}</td>`}

                    <td>${product?.product?.code || ''}</td>

                    <td>${product?.product?.name || product.name}</td>

                    <!-- if product with sizes, its probably "брой", else its "пакет" -->
                    ${isMobileDevice && type === 'stokova' ? '' : html`<td>${product?.product?.unitOfMeasure === 'пакет' ? 'бр.' : product?.product?.unitOfMeasure || product.unitOfMeasure}</td>`}

                    ${!isMobileDevice && flags.tableShowSizes ? html`<td>${product?.size}</td>` : ''}

                    <td class="text-nowrap">${product.quantity}</td>

                    ${isMobileDevice && type === 'stokova' && flags.tableShowDiscounts ? '' : html`<td class="text-nowrap">${formatPriceNoCurrency(type === 'stokova' ? product.price : deductVat(product.price, product.vat))}</td>`}

                    ${flags.tableShowDiscounts ? isMobileDevice && type === 'stokova' ? '' : html`<td>${product?.discount > 0 ? product.discount + '%' : '0%'}</td>` : ''}
                    
                    ${flags.tableShowDiscounts ? html`<td class="text-nowrap">${formatPriceNoCurrency(type === 'stokova' ? product.price * (1 - product.discount / 100) : deductVat((product.price * (1 - product.discount / 100)), product.vat))}</td>` : ''}
                    
                    ${type === 'stokova' || flags.noVat ? '' : html`<td class="text-nowrap">${product.vat}%</td>`}

                    <td class="text-nowrap">${formatPriceNoCurrency(type === 'stokova' ? ((product.price * product.quantity) * (1 - product.discount / 100)) : deductVat((product.price * product.quantity) * (1 - product.discount / 100), product.vat))}</td>
                </tr>
            `)}
        </tbody>
    </table >
    `;

async function loadNewCustomer(customer) {
    // close modal
    document.getElementById('closeModalBtn').click();

    // add customer to customers list
    customers = [...customers, customer];

    selectedCustomer = customer;

    // rerender table
    render(topRow(params, customers), document.getElementById('topRowContainer'));
    render(receiverTemplate(selectedCustomer.receivers), document.getElementById('receiverDiv'));
}

const createCustomerModal = () => html`
    <div class="modal fade d-print-none" id="createCustomerModal" tabindex = "-1" aria-labelledby="createCustomerModal" aria-hidden="true" >
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="exampleModalLabel">Създай партньор</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" id="closeModalBtn"></button>
                </div>
                <div class="modal-body">
                    ${customerForm({ modal: true, alertElId: "modalError", functionToRunOnSuccess: loadNewCustomer })}
                    <div id="modalError" class="d-none alert" role="alert"></div>
                </div>
            </div>
        </div>
</div >
    `;

const template = () => html`
    ${nav()}
    ${createCustomerModal()}
    <div class="container-fluid d-print-none">
        <form novalidate class="mt-3">
            <div class="row align-items-end g-3" id="topRowContainer"></div>
            <div class="row align-items-end g-3" id="secondTopRowContainer"></div>
            <div id="table" class="table-responsive"></div>
            <div id="bottomRow" class="g-3"></div>
            <div id="woocommerce" class="row g-3 align-items-end mt-1 ${order && order.woocommerce ? '' : 'd-none'}"></div>
        </form>
        <div id="alert" class="alert d-none"></div>
    </div>
    <div id="printContainer" class="d-none d-print-block"></div>
    <img id="rate-us-qr" class="d-none" style="width: 30%; margin: auto; margin-top: 5rem" src="images/rate-us-qr.jpg"/>`;

async function getDocumentTypeNumber() {
    const getNewDocumentNumber = await axios.get('/orders/number', { params: { documentType, company: selectedCompany._id } });
    documentNumber = getNewDocumentNumber.data;
    const numberEl = document.getElementById('number');
    if (numberEl) numberEl.value = pad(documentNumber, 0, 10);
}
export async function createEditOrderPage(ctx, next) {
    try {
        //TODO When all routes are converted to controllers, create single routes for this kind of requests. Instead of using 4 seperate requests to get companies, products, etc. do one single request to for example "/ordersInfo" and use the controllers to get all the info.
        const promises = [
            axios.get('/orders/params'),
            axios.get('/companies'),
            axios.get('/customers', { params: { page: 'createOrder' } }),
            axios.get('/settings', { params: { keys: ['orderType', 'paymentType', 'documentType', 'orderPrint'], } }),
        ];
        const [paramsRes, companiesRes, customersRes, defaultValuesRes] = await Promise.all(promises);
        params = paramsRes.data;
        companies = companiesRes.data.companies;
        customers = customersRes.data.customers;
        // find the "Служебен" customer and put it first in the array
        const privateCustomer = customers.find(customer => customer.name === 'Служебен');
        if (privateCustomer) {
            customers.splice(customers.indexOf(privateCustomer), 1);
            customers.unshift(privateCustomer);
        }
        defaultValues = defaultValuesRes.data;

        addedProductsIndex = 0;

        if (ctx.params.id) {
            const req = await axios.get(`/orders/${ctx.params.id}`);
            order = req.data;
            orderType = order.orderType;
            addedProducts = order.products;
            documentType = order.type;

            for (let product of addedProducts) {
                product.index = addedProductsIndex++;

                // Check if any size was removed from product and delete it from selectedSizes
                if (product.selectedSizes && product?.product?.sizes.length === 0) // product was converted from variable to simple
                    product.selectedSizes = [];

                else if (product.selectedSizes?.length > 0 && product?.product?.sizes.length > 0) {
                    // Check if any of the previously selected sizes was removed from the product and remove it from selectedSizes
                    for (let size of product.selectedSizes) {
                        if (!product.product.sizes.find(s => s.size === size)) {
                            product.selectedSizes = product.selectedSizes.filter(s => s !== size);
                        }
                    }
                }

                else if (product.selectedSizes?.length === 0 && product?.product?.sizes.length > 0) {
                    // Product was converted from simple to variable, enable all sizes
                    product.selectedSizes = product.product.sizes.map(s => s.size);
                }
            }

            selectedCustomer = order.customer;
            selectedCompany = companies.find(c => c._id === order.company._id);

            // if order was just created and print was requested
            if (ctx.querystring.includes('print')) {
                printSale(order);

                //FIXME UNCOMMENT
                // return page('/orders/create')
                return page(`/orders/${ctx.params.id}`);
            }
        } else {
            order = undefined;
            documentType = defaultValues.find(o => o.key === 'documentType').value;
            orderType = defaultValues.find(o => o.key === 'orderType').value;
            selectedCompany = companies[0];
            selectedCustomer = undefined;
            const customerEl = document.getElementById('customer')
            if (customerEl) customerEl.value = '';
            addedProducts = [];
            await getDocumentTypeNumber();
        }

        // reset form
        const form = document.querySelector('form');
        const alertEl = document.getElementById('alert');
        if (form && alertEl) {
            // form.reset();
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');
            alertEl.classList.add('d-none');
            document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
            document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
        }

        render(template(params, customers), container);
        render(topRow(params, customers), document.getElementById('topRowContainer'));
        render(secondTopRow(), document.getElementById('secondTopRowContainer'));
        if (order?.type !== 'credit' && documentType !== 'credit')
            document.getElementById('secondTopRowContainer').classList.add('d-none');
        if (!order) {
            document.getElementById('creditFromDate').value = '';
            document.getElementById('creditForNumber').value = '';
        }

        document.querySelector('#type option[value="' + documentType + '"]').selected = true;
        rerenderTable();
        render(senderTemplate(selectedCompany?.senders || []), document.getElementById('senderDiv'));
        render(receiverTemplate(selectedCustomer?.receivers || []), document.getElementById('receiverDiv'));

        // Set date in field
        document.getElementById('date').valueAsDate = order ? new Date(order.date) : new Date();
        document.getElementById('taxEventDate').valueAsDate = order ? new Date(order?.taxEventDate || order?.date) : new Date();

        if (order?.type === 'credit') {
            // Set date in field
            document.getElementById('creditFromDate').valueAsDate = new Date(order.creditFromDate);
        }

        // Add listener for barcode scanner
        const barcodeInput = document.getElementById('product');
        if (barcodeInput)
            barcodeInput.addEventListener('textInput', function (e) {
                if (e.data.length >= 10) {
                    const now = new Date().getTime();
                    // pause scanning for 0.1 second to skip duplicates
                    if (now < lastScanTime + 100)
                        return;

                    lastScanTime = now;
                    // Entered text with more than 10 characters at once (either by scanner or by copy-pasting value in field)
                    // simulate Enter key pressed on input field to activate addProduct function
                    const event = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        which: 13,
                        keyCode: 13,
                    });

                    barcodeInput.dispatchEvent(event);
                }
            });
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}