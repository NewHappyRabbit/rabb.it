import '@/css/products.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { markInvalid, markValid, roundPrice, successScan, loadPreviewImage, priceRegex, fixInputPrice } from '@/api';
import axios from "axios";
import { categoriesOptions } from '@/views/categories/categories';
import { until } from 'lit/directives/until.js';
import { nav } from '@/views/nav';
import { submitBtn, toggleSubmitBtn } from '@/views/components';
import { loggedInUser } from "@/views/login";
import Quagga from 'quagga';
import page from 'page';
import { socket } from '@/api';

var categories, selectedSizes, deliveryPriceFields, wholesalePriceFields, retailPriceField, wholesaleMarkup, retailMarkup, product, editPage = false, lastUpsaleAmount;

async function loadCategories(product) {
    const req = await axios.get('/categories');
    categories = req.data;

    const options = {
        categories,
        ...(product && { selected: product.category }),
        showNoParent: false,
    }

    return categoriesOptions(options);
}

function calculateUnitPrice() {
    // if (selectedSizes.length === 0) return; // if no sizes added, do nothing
    const deliveryEl = document.getElementById('deliveryPrice');
    const wholesalePrice = document.getElementById('wholesalePrice');
    const wholesaleUnitPrice = document.getElementById('wholesaleUnitPrice');
    const retailPrice = document.getElementById('retailPrice');
    const unitPriceEl = document.getElementById('deliveryPricePerUnit');
    const multiplier = parseInt(document.getElementById('multiplier').value) || 1;

    fixInputPrice({ target: unitPriceEl, roundPrice: true });

    const unitPrice = unitPriceEl.value;

    if (unitPriceEl.value === '') {
        deliveryEl.value = '';
        wholesalePrice.value = '';
        wholesaleUnitPrice.value = '';
        retailPrice.value = '';
        return unitPriceEl.value = '';
    }

    const sizesLength = selectedSizes.length || 1;
    const deliveryPriceEl = document.getElementById('deliveryPrice');
    deliveryPriceEl.value = roundPrice(unitPrice * parseInt(sizesLength * multiplier));

    calculateProductPrices();
}

function updateMultiplier() {
    const multiplier = document.getElementById('multiplier');
    fixInputPrice({ target: multiplier, int: true })
    calculateUnitPrice();
    updateWholeQuantity();
    updateQuantity();
}

function calculateProductPrices(e) {
    const deliveryPriceEl = document.getElementById('deliveryPrice');
    const wholesaleUnitPrice = document.getElementById('wholesaleUnitPrice');
    const wholesalePrice = document.getElementById('wholesalePrice');
    const retailPrice = document.getElementById('retailPrice');
    const unitPriceEl = document.getElementById('deliveryPricePerUnit');
    const multiplier = parseInt(document.getElementById('multiplier').value) || 1;
    const upsaleAmountEl = document.getElementById('upsaleAmount');
    const saleWholesalePrice = document.getElementById('saleWholesalePrice');

    fixInputPrice({ target: upsaleAmountEl });
    fixInputPrice({ target: deliveryPriceEl, roundPrice: true });

    const deliveryPrice = deliveryPriceEl.value;
    const upsaleAmount = Number(upsaleAmountEl.value) || 0;

    if (deliveryPriceEl.value === '') {
        wholesaleUnitPrice.value = '';
        deliveryPriceEl.value = '';
        wholesalePrice.value = '';
        retailPrice.value = '';
        saleWholesalePrice.value = '';
        return unitPriceEl.value = '';
    }

    // Update price per unit if coming from event (changing this price directly and not from the unitPrice funciton) and sizes are selected
    const sizesLength = selectedSizes.length || 1;
    if (e)
        unitPriceEl.value = (deliveryPrice / parseInt(sizesLength * multiplier)).toFixed(2);

    const wholesale = roundPrice(deliveryPrice * (1 + wholesaleMarkup / 100));

    //Retail price is calculated per piece, hencefore the price is divided by amount of sizes
    const retail = roundPrice(deliveryPrice * (1 + retailMarkup / 100) / parseInt(sizesLength * multiplier));

    wholesalePrice.value = roundPrice(wholesale + upsaleAmount * sizesLength * multiplier);
    wholesaleUnitPrice.value = (wholesale / parseInt(sizesLength * multiplier) + upsaleAmount).toFixed(2);
    retailPrice.value = roundPrice(retail + upsaleAmount);
    calculateSalePrice();
}

function resetUpsaleAmount() {
    const upsaleAmount = document.getElementById('upsaleAmount');
    upsaleAmount.value = '';
    lastUpsaleAmount = 0;
}

function calculatePriceWholesale() {
    const wholesaleUnitPrice = document.getElementById('wholesaleUnitPrice');
    const wholesalePrice = document.getElementById('wholesalePrice');
    const multiplier = parseInt(document.getElementById('multiplier').value) || 1;

    const upsaleAmount = document.getElementById('upsaleAmount');

    if (upsaleAmount.value !== '') {
        const retailPrice = document.getElementById('retailPrice');
        retailPrice.value = roundPrice(Number(retailPrice.value) - Number(upsaleAmount.value));
        upsaleAmount.value = '';
        lastUpsaleAmount = 0;
    }

    fixInputPrice({ target: wholesaleUnitPrice, roundPrice: true });

    const sizesLength = selectedSizes.length || 1;
    wholesalePrice.value = roundPrice(wholesaleUnitPrice.value * parseInt(sizesLength * multiplier));
    calculateSalePrice();
}

function calculateUnitPriceWholesale() {
    const wholesaleUnitPrice = document.getElementById('wholesaleUnitPrice');
    const wholesalePrice = document.getElementById('wholesalePrice');
    const multiplier = parseInt(document.getElementById('multiplier').value) || 1;

    fixInputPrice({ target: wholesalePrice, roundPrice: true });

    const sizesLength = selectedSizes.length || 1;
    wholesaleUnitPrice.value = (wholesalePrice.value / parseInt(sizesLength * multiplier)).toFixed(2);
    calculateSalePrice();
}

function updateTotalQty() {
    const totalQtyEl = document.getElementById('totalQty');
    const totalQuantity = selectedSizes.map(s => s.quantity).reduce((a, b) => a + b, 0);
    totalQtyEl.value = totalQuantity;
}

function updateQuantity() {
    const quantity = document.getElementById('quantity').value;
    const totalQtyEl = document.getElementById('totalQty');

    if (quantity === '' || selectedSizes.length === 0) {
        totalQtyEl.value = '';
        return;
    }

    updateTotalQty();

    // Update prices, because retail price uses quantity to calculate
    calculateProductPrices();
}

function clearSizesInputs(el) {
    el.value = '';
    el.focus();
    el.click();
}

function updateSizeQty() {
    const sumOfCalculator = parseInt(document.getElementById('calc_sum').value) || 0;

    // if (!product && sumOfCalculator > 0) // If editing product, create new size with 0 qty. If creating product, use sum from calcualtor
    selectedSizes.map(s => s.quantity = parseInt(sumOfCalculator / selectedSizes.length));

    const addedSizes = document.getElementById('addedSizes');
    render(sizesTemplate(selectedSizes), addedSizes);
    updateWholeQuantity();
}

function addSize(e, type) {
    e.preventDefault();
    if (!type) return;
    document.getElementById('deliveryPricePerUnit').disabled = false;
    document.getElementById('multiplier').disabled = false;
    let size;

    if (type === 'simpleSizesContainer') {
        const el = document.getElementById('simpleSize');
        const value = el.value.trim();
        clearSizesInputs(el);

        if (!value || value === '') return;
        size = value;
    } else if (type === 'rangeSizesContainer') {
        const fromEl = document.getElementById('rangeFrom');
        const toEl = document.getElementById('rangeTo');
        const from = fromEl.value.trim();
        const to = toEl.value.trim();
        clearSizesInputs(toEl);
        clearSizesInputs(fromEl);

        if (!from || from === '' || !to || to === '') return;
        size = from + '-' + to;
    }

    if (!selectedSizes.find(s => s.size.toLowerCase().trim() === size.toLowerCase().trim())) {
        selectedSizes.push({ size, quantity: product ? 0 : selectedSizes[0]?.quantity || 0 });

        updateSizeQty();
    }

    // Product whole quantity cant be edited when sizes exist
    document.getElementById('quantity').setAttribute('readonly', true);

    updateWholeQuantity();
    updateQuantity();
    calculateUnitPrice();
}

function removeSize(e) {
    e.preventDefault();
    const size = e.target.id.split('size-')[1];

    selectedSizes = selectedSizes.filter(s => s.size !== size);

    if (selectedSizes.length === 0) {
        document.getElementById('deliveryPricePerUnit').disabled = true;
        document.getElementById('multiplier').disabled = true;
        document.getElementById('multiplier').value = '';
    }

    const addedSizes = document.getElementById('addedSizes');

    if (selectedSizes.length === 0) document.getElementById('quantity').removeAttribute('readonly');

    updateQuantity();
    calculateUnitPrice();

    render(sizesTemplate(selectedSizes), addedSizes);
}

function showSizeContainer() {
    selectedFrom = undefined;
    selectedTo = undefined;
    const selected = document.getElementById('sizeType').value;

    const list = ['simpleSizesContainer', 'rangeSizesContainer', 'babysSizesContainer', 'kidsSizesContainer', 'youthsSizesContainer', 'adultsSizesContainer'];

    // Reset all selects in fromToTemplates
    const selectsToReset = document.querySelectorAll('.fromToTemplate select');

    selectsToReset.forEach(select => {
        select.value = '';
    });

    const btnsToDisable = document.querySelectorAll('.fromToApplyBtn');
    btnsToDisable.forEach(btn => {
        btn.disabled = true;
    });

    // Hide all containers and display only the selected
    list.forEach(el => {
        const container = document.getElementById(el);
        if (!container) return;
        container.classList.add('d-none');
        if (el === selected) container.classList.remove('d-none');
    });

    // Auto select attribute Size value
    const attributeSize = document.getElementById('sizes_groups');
    switch (selected) {
        case 'babysSizesContainer':
            attributeSize.value = 'Бебешки (0-24 м.)';
            break;
        case 'kidsSizesContainer':
            attributeSize.value = 'Детски (2-10 г.)';
            break;
        case 'youthsSizesContainer':
            attributeSize.value = 'Юношески (10-18 г.)';
            break;
        case 'adultsSizesContainer':
            attributeSize.value = 'Възрастни (S,M,L,XL,...)';
            break;
        default:
            attributeSize.value = '';
            break;
    }
}

function showSaleContainer() {
    const selected = document.getElementById('saleType').value;
    const el = document.getElementById('saleContainer')

    if (selected === '') {
        document.getElementById('saleWholesalePrice').value = '';
        return el.classList.add('d-none');
    }

    el.classList.remove('d-none');
}

function makeButtonActive(id) {
    const selected = document.getElementById(id);
    const sizesButtons = [document.getElementById('simpleSizeButton'), document.getElementById('rangeSizeButton')];

    sizesButtons.forEach(btn => btn.setAttribute('type', 'button'));
    selected.setAttribute('type', 'submit');
}

let sizesToApply = [];
let selectedFrom, selectedTo;
const babySizes = ['0 м.', '3 м.', '6 м.', '9 м.', '12 м.', '18 м.', '24 м.'];
const kidsSizes = ['2 г.', '3 г.', '4 г.', '5 г.', '6 г.', '7 г.', '8 г.', '9 г.', '10 г.'];
const youthsSizes = ['10 г.', '11 г.', '12 г.', '13 г.', '14 г.', '15 г.', '16 г.', '17 г.', '18 г.'];
const adultsSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'];

function applySizes() {
    document.getElementById('quantity').setAttribute('readonly', true);
    selectedSizes = sizesToApply.map(size => ({ size, quantity: 0 }));
    const addedSizes = document.getElementById('addedSizes');
    render(sizesTemplate(selectedSizes), addedSizes);
    document.getElementById('deliveryPricePerUnit').disabled = false;
    document.getElementById('multiplier').disabled = false;
}

function selectSizeFunction(e, from = true, fromId, toId, sizeApplyButtonId, sizesArray) {
    const selected = e.target.value == '' ? undefined : e.target.value;
    const selectToEl = from ? document.getElementById(toId) : document.getElementById(fromId);
    const allOptions = selectToEl.querySelectorAll('option');
    const sizeApplyButton = document.getElementById(sizeApplyButtonId);
    if (from)
        selectedFrom = selected;
    else selectedTo = selected;

    if (selected === '') return;

    const index = sizesArray.indexOf(selected);
    const optionsToDisable = from ? sizesArray.slice(0, index + 1) : sizesArray.slice(index, sizesArray.length);
    const optionsToApply = from ? sizesArray.slice(index, sizesArray.length) : sizesArray.slice(0, index + 1);

    if (selectedFrom && selectedTo) {
        sizesToApply = optionsToApply;
        sizeApplyButton.removeAttribute('disabled');
    } else {
        sizeApplyButton.setAttribute('disabled', true)
        sizesToApply = [];
    };

    for (let option of allOptions) {
        if (optionsToDisable.includes(option.value) || option.value === '') {
            option.setAttribute('disabled', true);
        } else {
            option.removeAttribute('disabled');
        }
    }
}

const fromToTemplate = ({ id, sizesArray, selectFn, fromId, toId, sizeApplyButtonId }) => html`
<div class="col-12 col-sm-6 d-none fromToTemplate" id=${id}>
    <div class="input-group">
        <select @change=${(e) => selectFn(e, true, fromId, toId, sizeApplyButtonId, sizesArray)} id=${fromId} class="form-select">
            <option disabled selected value="">Избери размер ОТ</option>
            ${sizesArray.map(size => html`<option value="${size}">${size}</option>`)}
        </select>
        <span class="input-group-text">-</span>
        <select @change=${(e) => selectFn(e, false, fromId, toId, sizeApplyButtonId, sizesArray)} id=${toId} class="form-select">
            <option disabled selected value="">Избери размер ДО</option>
            ${sizesArray.map(size => html`<option value="${size}">${size}</option>`)}
        </select>
        <button class="btn btn-primary fromToApplyBtn" disabled id=${sizeApplyButtonId} @click=${applySizes} type="button">Приложи</button>
    </div>
</div>
`;

const sizesSelectionTemplate = () => html`
    <h4>Размери:</h4>

    <div class="col-12 col-sm-6 mb-3">
        <select @change=${showSizeContainer} name="sizeType" id="sizeType" class="form-select">
            <option selected value="">Без размер</option>
            <option selected value="simpleSizesContainer">Свободен текст</option>
            <option value="rangeSizesContainer">Свободен От-До (39-43, 1-3,..)</option>
            <option value="babysSizesContainer">Бебешки (0-24 м.)</option>
            <option value="kidsSizesContainer">Детски (2-10г.)</option>
            <option value="youthsSizesContainer">Юношески (10-18г.)</option>
            <option value="adultsSizesContainer">Възрастни (S,M,L)</option>
        </select>
    </div>

    <!-- Simple -->
    <div class="col-12 col-sm-6" id="simpleSizesContainer">
        <div class="input-group">
            <input @keyup=${() => makeButtonActive('simpleSizeButton')} class="form-control" name="size" id="simpleSize" autocomplete="off" placeholder="S, 4XL, 43,..">
            <button id="simpleSizeButton" type="button" @click=${(e) => addSize(e, 'simpleSizesContainer')} class="btn btn-primary"><i class="bi bi-plus-lg"></i></button>
        </div>
    </div>

    <!-- Range -->
    <div class="col-12 col-sm-6 d-none" id="rangeSizesContainer">
        <div class="input-group">
            <input @keyup=${() => makeButtonActive('rangeSizeButton')} type="text" class="form-control" name="rangeFrom" id="rangeFrom" placeholder="39">
            <span class="input-group-text">-</span>
            <input @keyup=${() => makeButtonActive('rangeSizeButton')} type="text" class="form-control" name="rangeTo" id="rangeTo" placeholder="43">
            <button id="rangeSizeButton" type="button" @click=${(e) => addSize(e, 'rangeSizesContainer')} class="btn btn-primary"><i class="bi bi-plus-lg"></i></button>
        </div>
    </div>

    <!-- Baby -->
    ${fromToTemplate({ id: "babysSizesContainer", sizesArray: babySizes, selectFn: selectSizeFunction, fromId: "selectBabyFrom", toId: "selectBabyTo", sizeApplyButtonId: "babySizeApplyButton" })}
    
    <!-- Kids -->
    ${fromToTemplate({ id: "kidsSizesContainer", sizesArray: kidsSizes, selectFn: selectSizeFunction, fromId: "selectKidsFrom", toId: "selectKidsTo", sizeApplyButtonId: "kidsSizeApplyButton" })}

    <!-- Youth -->
    ${fromToTemplate({ id: "youthsSizesContainer", sizesArray: youthsSizes, selectFn: selectSizeFunction, fromId: "selectYouthsFrom", toId: "selectYouthsTo", sizeApplyButtonId: "youthsSizeApplyButton" })}

    <!-- Adults -->
    ${fromToTemplate({ id: "adultsSizesContainer", sizesArray: adultsSizes, selectFn: selectSizeFunction, fromId: "selectAdultsFrom", toId: "selectAdultsTo", sizeApplyButtonId: "adultsSizeApplyButton" })}

    <div id="addedSizes" class="d-flex gap-3 mt-1 pt-2 flex-wrap"></div>

    <h4 class="mt-2">Калкулатор:</h4>
    <div class="input-group mb-3">
        <input @keyup=${calculator} @change=${calculator} class="form-control" type="number" inputmode="numeric" autocomplete="off" id="calc_num1">
        <span class="input-group-text">X</span>
        <input @keyup=${calculator} @change=${calculator} class="form-control" type="number" inputmode="numeric" autocomplete="off" id="calc_num2">
        <input class="form-control" type="number" inputmode="numeric" autocomplete="off" disabled id="calc_sum">
    </div>

    <div class="col">
        <label for="sizes_groups">Размери:</label>
        <select id="sizes_groups" name="sizes_groups" class="form-control" multiple>
            <option ?selected=${!product} value="">Избери</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Бебешки (0-24 м.)'))} value='Бебешки (0-24 м.)'>Бебешки (0-24 м.)</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Детски (2-10 г.)'))} value='Детски (2-10 г.)'>Детски (2-10 г.)</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Юношески (10-18 г.)'))} value='Юношески (10-18 г.)'>Юношески (10-18 г.)</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Възрастни (S,M,L,XL,...)'))} value='Възрастни (S,M,L,XL,...)'>Възрастни (S,M,L,XL,...)</option>
        </select>
    </div>
`;

const quantityTemplate = () => html`
        <div class="row mb-3" id="qtyTemplate">
            <div class="col-12 col-sm-4 mb-3">
                <label for="quantity" class="form-label">Пакети
                </label>
                <div class="input-group">
                    <input @change=${updateQuantity} @keyup=${updateQuantity} class="form-control w-50 border-primary" type="number" inputmode="numeric" name="quantity" id="quantity" min="0" step="1" required .value=${product && product.quantity} autocomplete="off" ?readonly="${selectedSizes.length > 0 || editPage && loggedInUser.role !== 'admin'}">
                    <input class="form-control border-primary" type="text" placeholder="пакет" value=${product?.unitOfMeasure ? product.unitOfMeasure : ''} autocomplete="off" name="unitOfMeasure" id="unitOfMeasure" list="unitOfMeasureOptions">
                    <datalist id="unitOfMeasureOptions">
                        <option value="пакет"></option>
                        <option value="бр."></option>
                        <option value="кг."></option>
                        <option value="л."></option>
                    </datalist>
                </div>
            </div>

            <div class="col-12 col-sm-4 mb-3">
                <label for="multiplier" class="form-label">Бройки в пакет</label>
                <input @change=${updateMultiplier} @keyup=${updateMultiplier} class="form-control" type="number" inputmode="numeric" name="multiplier" id="multiplier" min="1" step="1" required .value=${product && product.multiplier} placeholder="1" autocomplete="off" ?disabled="${selectedSizes.length === 0}">
            </div>

            <div class="col-12 col-sm-4 mb-3 d-none">
                <label for="minQty" class="form-label">Мин. брой за на едро</label>
                <input class="form-control" type="number" inputmode="numeric" name="minQty" id="minQty" min="0" step="1" aria-describedby="minQtyHelp" .value=${product && product.minQty} autocomplete="off">
                <div id="minQtyHelp" class="form-text">Бройки които да се запазят за продажби на едро. Няма да може да се продават на дребно.</div>
            </div>

            <div class="col-12 col-sm-4">
                <label for="totalQty" class="form-label">Общ брой</label>
                <input class="form-control" type="number" .value=${product?.sizes?.length > 0 ? product.sizes.map(s => s.quantity).reduce((a, b) => a + b, 0) : ''} id="totalQty" min="0" step="1" disabled>
            </div>
        </div>
    `;
const pricesTemplate = () => html`
        <div class="row mb-3 row-gap-3 align-items-end">
            <div class="col ${!['both', 'unit'].includes(deliveryPriceFields) ? 'd-none' : ''}">
                <label for="deliveryPricePerUnit" class="form-label">Доставна цена за брой</label>
                <input @keyup=${calculateUnitPrice} class="form-control border-primary" type="text" name="deliveryPricePerUnit" id="deliveryPricePerUnit" ?disabled=${selectedSizes.length === 0} inputmode="decimal" .value=${product && product.sizes?.length && roundPrice(product.deliveryPrice / (product.sizes.length * (product.multiplier || 1)))} autocomplete="off">
            </div>

            <div class="col ${!['both', 'whole'].includes(deliveryPriceFields) ? 'd-none' : ''}">
                <label for="deliveryPrice" class="form-label">Доставна цена за пакет</label>
                <input @keyup=${calculateProductPrices} class="form-control border-primary" type="text" inputmode="decimal" name="deliveryPrice" id="deliveryPrice" required .value=${product && product.deliveryPrice} autocomplete="off">
            </div>

            <div class="col pe-0 ${!['both', 'unit'].includes(wholesalePriceFields) ? 'd-none' : ''}"">
                <label for="unitPrice" class="form-label">Цена на едро за брой <span class="text-primary">(+${wholesaleMarkup}%)</span></label>
                <input class="form-control border-primary" @keyup=${calculatePriceWholesale} type="text" name="wholesaleUnitPrice" id="wholesaleUnitPrice" inputmode="decimal" .value=${product && product.sizes?.length && roundPrice(product.wholesalePrice / (product.sizes.length * (product.multiplier || 1)))} autocomplete="off">
            </div>


            <div class="col pe-0 ${!['both', 'whole'].includes(wholesalePriceFields) ? 'd-none' : ''}"">
                <label for="wholesalePrice" class="form-label">Цена на едро <span class="text-primary">(+${wholesaleMarkup}%)</span></label>
                <input class="form-control border-primary" @keyup=${calculateUnitPriceWholesale} type="text" name="wholesalePrice" id="wholesalePrice" inputmode="decimal" required .value=${product && product.wholesalePrice} autocomplete="off">
            </div>

            <div class="col ${retailPriceField === 'true' ? '' : 'd-none'}">
                <label for="retailPrice" class= "form-label" > Цена на дребно <span class="text-primary"> (+${retailMarkup}%)</span></label >
                <input class="form-control border-primary" type="text" name="retailPrice" id="retailPrice" inputmode="decimal" required .value=${product && product.retailPrice} @keyup=${resetUpsaleAmount} autocomplete="off">
            </div>

            <div class="col">
                <label for="upsaleAmount" class="form-label">Добавена стойност към всеки брой <span class="text-primary">(лв.)</span></label>
                <input @keyup=${() => calculateProductPrices()} class="form-control border-primary" type="text" name="upsaleAmount" id="upsaleAmount" inputmode="decimal" .value=${lastUpsaleAmount} autocomplete="off">
            </div>
        </div>
    `;

function calculateSalePrice() {
    const saleType = document.getElementById('saleType').value;
    const saleAmount = document.getElementById('saleAmount').value;
    const saleWholesalePrice = document.getElementById('saleWholesalePrice');
    const wholesalePrice = document.getElementById('wholesalePrice').value;

    if (saleType === 'percent') {
        saleWholesalePrice.value = roundPrice(wholesalePrice - (wholesalePrice * saleAmount / 100));
    } else if (saleType === 'sum') {
        saleWholesalePrice.value = roundPrice(wholesalePrice - saleAmount);
    } else {
        saleWholesalePrice.value = '';
    }
}

const saleWholesalePriceTemplate = () => html`
    <div class="row mb-3 row-gap-3 align-items-end">
        <label class="form-label">Промо цена:</label>
        <div class="col">
            <select @change=${showSaleContainer} name="saleType" id="saleType" class="form-select" ?disabled=${loggedInUser.role !== 'admin'}>
                <option selected value="">Без намаление</option>
                <option value="percent">Намали с процент (%)</option>
                <option value="sum">Намали със сума (лв.)</option>
            </select>
        </div>
        <div id="saleContainer" class="row ${product?.saleWholesalePrice ? '' : 'd-none'}">
            <div class="col pe-0">
                <label for="saleAmount" class="form-label">Намали с</label>
                <input class="form-control border-primary" @keyup=${calculateSalePrice} type="text" name="saleAmount" id="saleAmount" inputmode="decimal" autocomplete="off" ?disabled=${loggedInUser.role !== 'admin'}>
            </div>
            <div class="col pe-0">
                <label for="saleWholesalePrice" class="form-label">Намалена цена на едро</label>
                <input class="form-control" type="text" name="saleWholesalePrice" id="saleWholesalePrice" inputmode="decimal" .value=${product?.saleWholesalePrice || ""} autocomplete="off" ?disabled=${loggedInUser.role !== 'admin'}>
            </div>
        </div>
    </div>
`

function updateWholeQuantity() {
    // This function updates the packages quantity depending on the selected sizes size with least quantity
    const multiplier = parseInt(document.getElementById('multiplier').value) || 1;
    const leastQuantity = Math.min(...selectedSizes.map(s => s.quantity));
    document.getElementById('quantity').value = parseInt(leastQuantity / multiplier);
}

function updateSizeQuantity(e) {
    const { name, value } = e.target;

    // TODO Fix the input price to be decimal instead of integer, since other shops may have products that are in kilograms, meters, etc.
    fixInputPrice({ target: e.target, int: true });

    const size = selectedSizes.find(s => s.size === name.split('-quantity')[0]);
    size.quantity = Number(value);

    updateTotalQty();

    updateWholeQuantity();
}

const sizesTemplate = () => html`
    ${selectedSizes.map(size => html`
        <div class="input-group sizeElement">
            <label for="${size.size}-quantity" class="input-group-text border-primary">${size.size}</label>
            <input class="form-control border-primary" type="text" @keyup=${updateSizeQuantity} name="${size.size}-quantity" id="${size.size}-quantity" inputmode="decimal" required .value=${size.quantity} autocomplete="off" ?readonly=${editPage && loggedInUser.role !== 'admin'}>
            <button class="btn btn-outline-secondary bgDangerHover" id="size-${size.size}" @click=${removeSize} type="button">X</button>
        </div>`)
    }
`;

function removeImage(e) {
    const dt = new DataTransfer();
    const input = document.getElementById('additionalImages');
    const { files } = input;

    for (let file of files) {
        if (file.name !== e.target.getAttribute('filename'))
            dt.items.add(file);
    }

    input.files = dt.files // Assign the updates list to the input field

    e.target.parentElement.remove(); // Delete the div element of the image
};

const imgTemplate = (img, fileName) => html`
    <div class="uploadImgContainer m-1">
        <img src="${img}" class="img-thumbnail" alt="">
            ${fileName ? html`<button type="button" @click=${removeImage} fileName=${fileName} class="btn btn-danger">X</button>` : ''}
        </div>
`;

function validateProduct(data) {
    var invalidFlag = false;

    if (!data.name)
        invalidFlag = markInvalid('name');
    else markValid('name');

    if (!data.category)
        invalidFlag = markInvalid('category');
    else markValid('category');

    data.hidden = typeof data.hidden === 'string' ? true : false;

    if (data?.quantity === '' || data?.quantity === undefined || data?.quantity < 0)
        invalidFlag = markInvalid('quantity');
    else markValid('quantity');

    // Check if each size has a quantity
    if (selectedSizes.length > 0) {
        selectedSizes.map(size => {
            if (size?.quantity == undefined)
                invalidFlag = markInvalid(`${size.size}-quantity`);
            else markValid(`${size.size}-quantity`);
        })
    }

    if (!data.deliveryPrice || data.deliveryPrice < 0 || !priceRegex.test(data.deliveryPrice)) {
        invalidFlag = markInvalid('deliveryPrice');
        markInvalid('deliveryPricePerUnit');
    } else {
        markValid('deliveryPrice');
        markValid('deliveryPricePerUnit');
    }

    if (!data.wholesalePrice || data.wholesalePrice < 0 || !priceRegex.test(data.wholesalePrice) || Number(data.deliveryPrice) >= Number(data.wholesalePrice)) {
        invalidFlag = markInvalid('wholesalePrice');
        markInvalid('wholesaleUnitPrice');
    } else {
        markValid('wholesalePrice');
        markValid('wholesaleUnitPrice');
    }

    const sizesLength = selectedSizes.length || 1;
    const multiplier = parseInt(data.multiplier) || 1;
    if (!data.retailPrice || data.retailPrice < 0 || !priceRegex.test(data.retailPrice) || Number(data.deliveryPrice / (sizesLength * multiplier)) >= Number(data.retailPrice))
        invalidFlag = markInvalid('retailPrice');
    else markValid('retailPrice');

    if (data.saleWholesalePrice && (data.saleWholesalePrice < 0 || !priceRegex.test(data.saleWholesalePrice))) {
        invalidFlag = markInvalid('saleWholesalePrice');
    } else markValid('saleWholesalePrice');

    return invalidFlag;
}

async function updateProduct(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = document.querySelector('form');
    const formData = new FormData(form);

    const data = Object.fromEntries(formData.entries());

    data.sizes = selectedSizes;

    formData.set('sizes', JSON.stringify(data.sizes));

    const invalidData = validateProduct(data);
    if (invalidData) return toggleSubmitBtn();

    form.classList.add('was-validated');
    form.classList.remove('needs-validation');

    const alertEl = document.getElementById('alert');

    try {
        const req = product ? await axios.put(`/products/${product._id}`, formData) : await axios.post('/products', formData);
        if (req.status === 201) {
            toggleSubmitBtn();

            if (!product) { // if product creation and not editing
                document.getElementById('category').classList.remove('is-valid', 'is-invalid');
                selectedSizes = [];
                render(sizesTemplate(), document.getElementById('addedSizes'));
                document.getElementById('imagePreview').src = '';
                document.getElementById('imagePreview').classList.add('d-none');
                document.getElementById('additionalImagesPreview').innerHTML = '';

                form.reset();
            }

            document.querySelectorAll('input').forEach(el => el.classList.remove('is-valid', 'is-invalid'));

            form.classList.remove('was-validated');
            form.classList.add('needs-validation');
            alertEl.classList.remove('d-none', 'alert-danger');
            alertEl.classList.add('alert-success');
            document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
            document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
            alertEl.textContent = `Продуктът е ${product ? 'редактиран' : 'създаден'} успешно.`;

            //FIXME DELETE AFTER SVILEN ENTERS ALL HIS PRODUCTS IN DB
            const newProduct = req.data;
            page(`/products/${newProduct._id}`);
            // FIXME DELETE END LINE
        }
    } catch (err) {
        toggleSubmitBtn();
        if (err.response.status === 400 || err.response.status === 404) {
            alertEl.classList.remove('d-none', 'alert-success');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = err.response.data;
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');

            if (err.response.data.toLowerCase().includes(' код')) {
                markInvalid('code');
            }

            if (err.response.data.toLowerCase().includes('баркод')) {
                markInvalid('barcode');
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

var scanned = false;
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
        scanned = false;

        Quagga.onDetected(data => {
            if (scanned) return; // this is used because every time you init Quagga, it adds a new listener and starts duplicating events
            scanned = true;

            Quagga.stop();
            const barcode = data.codeResult.code;
            document.getElementById('barcode').value = barcode;
            successScan(document.getElementById('barcode'));
            videoEl.innerHTML = ''
            scanBarcodeBtn.classList.remove('d-none');
            cancelBarcodeBtn.classList.add('d-none');
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

function loadPreviewImages(e) {
    const additionalImagesPreview = document.getElementById('additionalImagesPreview');

    var files = e.target.files;
    var filesArr = Array.prototype.slice.call(files);
    var htmlArray = [];

    filesArr.forEach(function (file, index) {
        if (!file.type.match('image.*')) {
            return;
        }

        var reader = new FileReader();

        reader.onload = function (e) {
            htmlArray.push(imgTemplate(e.target.result, file.name));
            render(htmlArray, additionalImagesPreview);
        }
        reader.readAsDataURL(file);
    });
}

function selectCategory(e) {
    // FIXME Delete this after svilen enters all his products in db
    document.getElementById('category').value = e.target.value;
    document.getElementById('name').value = categories.find(c => c._id === e.target.value).name;
}

function onSelectAttrCategory(e) {
    const category = e.target.value;

    document.querySelectorAll('#sex option').forEach(opt => opt.selected = false);
    document.querySelectorAll('#sizes_groups option').forEach(opt => opt.selected = false);
    document.querySelectorAll('#sizeType option').forEach(opt => opt.selected = false);

    if (category === 'Мъжки') {
        document.querySelector('#sex [value="За него"]').selected = true;
        document.querySelector('#sizes_groups [value="Възрастни (S,M,L,XL,...)"]').selected = true;
        document.querySelector('#sizeType [value="simpleSizesContainer"]').selected = true;
    }
    else if (category === 'Дамски') {
        document.querySelector('#sex [value="За нея"]').selected = true;
        document.querySelector('#sizes_groups [value="Възрастни (S,M,L,XL,...)"]').selected = true;
        document.querySelector('#sizeType [value="simpleSizesContainer"]').selected = true;
    }
    showSizeContainer();
}

const attributesTemplate = (product) => html`
    <div class="row mb-3">
        <h4>Атрибути:</h4>
        <div class="col">
            <label for="season">Сезон:</label>
            <select id="season" name="season" class="form-control" multiple>
                <option value="">Избери</option>
                <option ?selected=${!product || product?.attributes?.find(a => a.attribute.slug === 'season' && a.value === 'Пролет/Лято' || a.value.includes('Пролет/Лято'))} value='Пролет/Лято'>Пролет/Лято</option>
                <option ?selected=${!product || product?.attributes?.find(a => a.attribute.slug === 'season' && a.value === 'Есен/Зима' || a.value.includes('Есен/Зима'))} value='Есен/Зима'>Есен/Зима</option>
            </select>
        </div>

        <div class="col">
            <label for="in_category">Категория:</label>
            <select @change=${onSelectAttrCategory} id="in_category" name="in_category" class="form-control">
                <option ?selected=${!product} value="">Избери</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value.includes('Детски'))} value='Детски'>Детски</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value.includes('Мъжки'))} value='Мъжки'>Мъжки</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value.includes('Дамски'))} value='Дамски'>Дамски</option>
            </select>
        </div>

        <div class="col">
            <label for="sex">Пол:</label>
            <select id="sex" name="sex" class="form-control" multiple>
                <option ?selected=${!product} value="">Избери</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sex' && a.value === 'За него' || a.value.includes('За него'))} value='За него'>За него</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sex' && a.value === 'За нея' || a.value.includes('За нея'))} value='За нея'>За нея</option>
            </select>
        </div>
    </div>
`;

function calculator() {
    const num1 = document.getElementById('calc_num1').value || 0;
    const num2 = document.getElementById('calc_num2').value || 0;
    const sum = document.getElementById('calc_sum');

    sum.value = Number(num1) * Number(num2);
    updateSizeQty();
}

export async function createEditProductPage(ctx, next) {
    try {
        if (ctx.params.id) {
            editPage = true;
            const req = await axios.get(`/products/${ctx.params.id}`);
            product = req.data;
            selectedSizes = product.sizes;
        } else {
            editPage = false;
            product = '';
            selectedSizes = [];
        }

        const keys = ['wholesaleMarkup', 'retailMarkup', 'deliveryPriceFields', 'wholesalePriceFields', 'retailPriceField', 'upsaleAmount'];
        const req = await axios.get('/settings', { params: { keys } });
        wholesaleMarkup = req.data.find(s => s.key === 'wholesaleMarkup').value;
        retailMarkup = req.data.find(s => s.key === 'retailMarkup').value;
        deliveryPriceFields = req.data.find(s => s.key === 'deliveryPriceFields').value;
        wholesalePriceFields = req.data.find(s => s.key === 'wholesalePriceFields').value;
        retailPriceField = req.data.find(s => s.key === 'retailPriceField').value;
        lastUpsaleAmount = product.upsaleAmount || req.data.find(s => s.key === 'upsaleAmount').value;
    } catch (err) {
        console.error(err);
        alert('Възникна грешка')
    }

    const template = () => html`
        ${nav()}
        <div class="container-fluid">
            <form enctype="multipart/form-data" novalidate id="createProductForm" class="needs-validation p-2">
                <div class="row mb-3">
                    <label for="image" class="form-label">Главна снимка</label>
                    <input @change=${loadPreviewImage} name="image" class="form-control" type="file" id="image" accept="capture=camera,image/*">
                    <img id="imagePreview" class="${product?.image?.url ? '' : 'd-none'} img-thumbnail w-25" .src=${product?.image?.url} alt="">
                </div>

                <div class="row mb-3">
                    <label for="additionalImages" class="form-label">Допълнителни снимка</label>
                    <input @change=${loadPreviewImages} class="form-control" type="file" name="additionalImages" id="additionalImages" accept="image/*" multiple>
                    <div id="additionalImagesPreview" class="d-flex flex-wrap"></div>
                </div>

                <div class="row mb-3">
                    <label for="category" class="form-label">Категория</label>
                    <select @change=${selectCategory} class="form-select border-primary" name="category" id="category" required>
                        ${until(loadCategories(product), html`<option disabled>Зареждане...</option>`)}
                    </select>
                </div>

                <div class="row mb-3">
                    <label for="name" class="form-label">Име</label>
                    <input class="form-control border-primary" type="text" name="name" id="name" placeholder="Цветна тениска" .value=${product && product.name} required autocomplete="off">
                </div>

                ${attributesTemplate(product)}

                <div class="row mb-3" id="sizesSelection">
                    ${sizesSelectionTemplate()}
                </div>

                ${quantityTemplate()}

                ${pricesTemplate()}

                <div class="row mb-3">
                    <label for="vat" class="form-label">ДДС %</label>
                    <select name="vat" class="form-control">
                        <option ?selected=${product && product.vat === 0} value='0'>0%</option>
                        <option ?selected=${product && product.vat === 9} value='9'>9%</option>
                        <option ?selected=${!product || product?.vat === 20} value='20'>20%</option>
                    </select>
                </div>

                <div class="row mb-3">
                    <label for="description" class="form-label">Описание</label>
                    <textarea class="form-control" name="description" id="description" rows="3" placeholder="Много готина тениска" .value=${product && product.description} autocomplete="off"></textarea>
                </div>

                <div class="row mb-3">
                    <label for="code" class="form-label">Код</label>
                    <input class="form-control" type="text" name="code" id="code" .value=${product?.code || ''} autocomplete="off">
                </div>

                <div class="row mb-3">
                    <div id="barcodeVideo"></div>
                    <label for="barcode" class="form-label">Баркод</label>
                    <div class="input-group p-0">
                        <input class="form-control" type="text" name="barcode" id="barcode" .value=${product && product.barcode || ''} autocomplete="off">
                        <button @click=${scanBarcode} class="btn btn-primary" type="button" id="scanBarcode"><i class="bi bi-camera"></i> Сканирай</button>
                        <button @click=${stopBarcode} class="btn btn-primary d-none" type="button" id="stopBarcode"><i class="bi bi-camera"></i> Затвори</button>
                    </div >
                </div >

                <h3>Опции</h3>
                <div class="mb-3">
                    <input class="form-check-input" type="checkbox" value="" name="hidden" id="hidden" ?checked=${product?.hidden}>
                    <label class="form-check-label" for="hidden">
                        Скрит продукт (не се показва в сайта)
                    </label>
                </div>

                ${editPage ?
            html`
                <div class="input-group mb-3 mt-3 w-25">
                    <input id="printLabelQty" @keyup=${(e) => fixInputPrice({ target: e.target, int: true })} class="form-control" type="text" name="printLabel" id="printLabel">
                    <button @click=${() => socket.emit('send-print', product, Number(document.getElementById("printLabelQty").value))} class="btn btn-outline-primary" type="button">Принтирай етикети</button>
                </div>`
            : html`
                    <div class="mb-3">
                        <input class="form-check-input" type="checkbox" value="" name="printLabel" id="printLabel" checked>
                        <label class="form-check-label" for="printLabel">
                            Принтирай етикети
                        </label>
                    </div>`}

                ${saleWholesalePriceTemplate()}

                <div id="alert" class="d-none alert" role="alert"></div>
                ${['manager', 'admin'].includes(loggedInUser.role) || loggedInUser.role === 'user' && !editPage ? submitBtn({ type: 'button', icon: 'bi-check-lg', classes: 'd-block m-auto col-sm-3', func: updateProduct }) : ''}
            </form >
        </div > `;

    render(template(), container);
    render(sizesTemplate(selectedSizes), document.getElementById('addedSizes'));

    document.getElementById('calc_num1').value = '';
    document.getElementById('calc_num2').value = '';
    document.getElementById('calc_sum').value = '';

    // If product has images, render them
    if (product && product.additionalImages.length > 0)
        render(product.additionalImages.map(img => imgTemplate(img.url)), document.getElementById('additionalImagesPreview'));

    // If product has sizes, enable deliveryPricePerUnit
    if (selectedSizes.length)
        document.getElementById('deliveryPricePerUnit').disabled = false;
}