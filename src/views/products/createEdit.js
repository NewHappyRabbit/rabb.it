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

var selectedSizes, deliveryPriceFields, wholesalePriceFields, retailPriceField, wholesaleMarkup, retailMarkup, product, editPage = false;

async function loadCategories() {
    const req = await axios.get('/categories');
    const categories = req.data;

    const options = {
        categories,
        selected: product && product.category,
        showNoParent: false,
        disableWithChilden: true
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

    fixInputPrice(unitPriceEl, true);

    const unitPrice = unitPriceEl.value;

    if (unitPriceEl.value === '') {
        deliveryEl.value = '';
        wholesalePrice.value = '';
        wholesaleUnitPrice.value = '';
        retailPrice.value = '';
        return unitPriceEl.value = '';
    }

    const deliveryPriceEl = document.getElementById('deliveryPrice');
    deliveryPriceEl.value = roundPrice(unitPrice * (selectedSizes.length || 1));

    calculateProductPrices();
}

function calculateProductPrices(e) {
    const deliveryPriceEl = document.getElementById('deliveryPrice');
    const wholesaleUnitPrice = document.getElementById('wholesaleUnitPrice');
    const wholesalePrice = document.getElementById('wholesalePrice');
    const retailPrice = document.getElementById('retailPrice');
    const unitPriceEl = document.getElementById('deliveryPricePerUnit');

    fixInputPrice(deliveryPriceEl, true);

    const deliveryPrice = deliveryPriceEl.value;

    if (deliveryPriceEl.value === '') {
        wholesaleUnitPrice.value = '';
        deliveryPriceEl.value = '';
        wholesalePrice.value = '';
        retailPrice.value = '';
        return unitPriceEl.value = '';
    }

    // Update price per unit if coming from event (changing this price directly and not from the unitPrice funciton) and sizes are selected
    if (e)
        unitPriceEl.value = (deliveryPrice / (selectedSizes.length || 1)).toFixed(2);

    const wholesale = roundPrice(deliveryPrice * (1 + wholesaleMarkup / 100));

    //Retail price is calculated per piece, hencefore the price is divided by amount of sizes
    const sizesLength = selectedSizes.length || 1;
    const retail = roundPrice(deliveryPrice * (1 + retailMarkup / 100) / sizesLength);

    wholesalePrice.value = roundPrice(wholesale);
    wholesaleUnitPrice.value = (wholesale / sizesLength).toFixed(2);
    retailPrice.value = roundPrice(retail);
}

function calculatePriceWholesale() {
    const wholesaleUnitPrice = document.getElementById('wholesaleUnitPrice');
    const wholesalePrice = document.getElementById('wholesalePrice');

    fixInputPrice(wholesaleUnitPrice, true);

    wholesalePrice.value = roundPrice(wholesaleUnitPrice.value * (selectedSizes.length || 1));
}

function calculateUnitPriceWholesale() {
    const wholesaleUnitPrice = document.getElementById('wholesaleUnitPrice');
    const wholesalePrice = document.getElementById('wholesalePrice');


    fixInputPrice(wholesalePrice, true);

    wholesaleUnitPrice.value = (wholesalePrice.value / (selectedSizes.length || 1)).toFixed(2);
}

function updateQuantity() {
    const quantity = document.getElementById('quantity').value;
    const quantityEl = document.getElementById('quantityEl');

    if (quantity === '' || selectedSizes.length === 0) {
        quantityEl.value = '';
        return;
    }

    const totalQuantity = selectedSizes.length * quantity;

    quantityEl.value = totalQuantity;

    // Update prices, because retail price uses quantity to calculate
    calculateProductPrices();
}

function addSize(e) {
    e.preventDefault();
    document.getElementById('deliveryPricePerUnit').disabled = false;
    const sizeEl = document.getElementById('size');
    const suffixEl = document.getElementById('suffix');
    const suffix = suffixEl.value;

    const size = suffix ? sizeEl.value + suffix : sizeEl.value;

    if (size !== '' && !selectedSizes.includes(size)) {
        selectedSizes.push(size);

        const addedSizes = document.getElementById('addedSizes');

        render(sizesTemplate(selectedSizes), addedSizes);
    }

    updateQuantity();

    sizeEl.value = '';
    sizeEl.focus();
}

function removeSize(e) {
    e.preventDefault();
    const size = e.target.textContent;
    selectedSizes = selectedSizes.filter(s => s !== size);

    if (selectedSizes.length === 0)
        document.getElementById('deliveryPricePerUnit').disabled = true;

    const addedSizes = document.getElementById('addedSizes');

    updateQuantity();

    render(sizesTemplate(selectedSizes), addedSizes);
}

const quantityTemplate = () => html`
        <div class="row mb-3" id="qtyTemplate">
            <div class="col-12 col-sm-4 mb-3">
                <label for="quantity" class="form-label">Брой | Мярка</label>
                <div class="input-group">
                    <input @change=${updateQuantity} @keyup=${updateQuantity} class="form-control w-50 border-primary" type="number" inputmode="numeric" name="quantity" id="quantity" min="1" step="1" required .value=${product && product.quantity} autocomplete="off" ?readonly="${editPage}">
                    <input class="form-control border-primary" type="text" placeholder="пакет" value=${product?.unitOfMeasure ? product.unitOfMeasure : ''} autocomplete="off" name="unitOfMeasure" id="unitOfMeasure" list="unitOfMeasureOptions">
                    <datalist id="unitOfMeasureOptions">
                        <option value="пакет"></option>
                        <option value="бр."></option>
                        <option value="кг."></option>
                        <option value="л."></option>
                    </datalist>
                </div>
            </div>

            <div class="col-12 col-sm-3 mb-3 d-none">
                <label for="minQty" class="form-label">Мин. брой за на едро</label>
                <input class="form-control" type="number" inputmode="numeric" name="minQty" id="minQty" min="0" step="1" aria-describedby="minQtyHelp" .value=${product && product.minQty} autocomplete="off">
                <div id="minQtyHelp" class="form-text">Бройки които да се запазят за продажби на едро. Няма да може да се продават на дребно.</div>
            </div>

            <div class="col-12 col-sm-4 mb-3">
                <label for="size" class="form-label">Размери | Суфикс</label>
                <div class="input-group">
                    <input class="form-control" name="size" id="size" autocomplete="off" ?readonly="${editPage}">
                    <input class="form-control" name="suffix" id="suffix" autocomplete="off" placeholder="г. / м.">
                    <button @click=${addSize} class="btn btn-primary" ?disabled=${editPage}><i class="bi bi-plus-lg"></i></button>
                </div>
                <div id="addedSizes" class="d-flex gap-1 mt-1 flex-wrap"></div>
            </div>

            <div class="col-12 col-sm-4">
                <label for="quantityEl" class="form-label">Общ брой</label>
                <input class="form-control" type="number" .value=${product && product.quantity * selectedSizes.length} id="quantityEl" min="0" step="1" disabled>
            </div>
        </div>
    `;

const pricesTemplate = () => html`
        <div class="row mb-3 row-gap-3 align-items-end">
            <div class="col ${!['both', 'unit'].includes(deliveryPriceFields) ? 'd-none' : ''}">
                <label for="deliveryPricePerUnit" class="form-label">Доставна цена за брой</label>
                <input @change=${calculateUnitPrice} @keyup=${calculateUnitPrice} class="form-control border-primary" type="text" name="deliveryPricePerUnit" id="deliveryPricePerUnit" inputmode="decimal" .value=${product && product.sizes?.length && roundPrice(product.deliveryPrice / product.sizes.length)} autocomplete="off">
            </div>

            <div class="col ${!['both', 'whole'].includes(deliveryPriceFields) ? 'd-none' : ''}">
                <label for="deliveryPrice" class="form-label">Доставна цена за пакет</label>
                <input @change=${calculateProductPrices} @keyup=${calculateProductPrices} class="form-control border-primary" type="text" inputmode="decimal" name="deliveryPrice" id="deliveryPrice" required .value=${product && product.deliveryPrice} autocomplete="off">
            </div>

            <div class="col pe-0 ${!['both', 'unit'].includes(wholesalePriceFields) ? 'd-none' : ''}"">
                <label for="unitPrice" class="form-label">Цена на едро за брой <span class="text-primary">(+${wholesaleMarkup}%)</span></label>
                <input class="form-control border-primary" @keyup=${calculatePriceWholesale} type="text" name="wholesaleUnitPrice" id="wholesaleUnitPrice" inputmode="decimal" .value=${product && product.sizes?.length && roundPrice(product.wholesalePrice / product.sizes.length)} autocomplete="off">
            </div>


            <div class="col pe-0 ${!['both', 'whole'].includes(wholesalePriceFields) ? 'd-none' : ''}"">
                <label for="wholesalePrice" class="form-label">Цена на едро <span class="text-primary">(+${wholesaleMarkup}%)</span></label>
                <input class="form-control border-primary" @keyup=${calculateUnitPriceWholesale} type="text" name="wholesalePrice" id="wholesalePrice" inputmode="decimal" required .value=${product && product.wholesalePrice} autocomplete="off">
            </div>

            <div class="col ${retailPriceField === 'true' ? '' : 'd-none'}">
            <label for="retailPrice" class= "form-label" > Цена на дребно <span class="text-primary"> (+${retailMarkup}%)</span></label >
            <input class="form-control border-primary" type="text" name="retailPrice" id="retailPrice" inputmode="decimal" required .value=${product && product.retailPrice} autocomplete="off">
            </div>
        </div>
    `;

const sizesTemplate = () => html`
        ${selectedSizes.map(size => html`
            ${editPage ? html`<div class="btn bg-primary text-white">${size}</div>` : html`<button @click=${removeSize} class="btn bg-primary bgDangerHover">${size}</button>`}
        `)
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
            ${fileName ? html`<button @click=${removeImage} fileName=${fileName} class="btn btn-danger">X</button>` : ''}
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

    if (!data.quantity)
        invalidFlag = markInvalid('quantity');
    else markValid('quantity');

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

    if (!data.retailPrice || data.retailPrice < 0 || !priceRegex.test(data.retailPrice) || Number(data.deliveryPrice / (selectedSizes.length || 1)) >= Number(data.retailPrice))
        invalidFlag = markInvalid('retailPrice');
    else markValid('retailPrice');

    return invalidFlag;
}

async function updateProduct(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = e.target;
    const formData = new FormData(form);

    const data = Object.fromEntries(formData.entries());
    data.sizes = selectedSizes.map(size => ({ size, quantity: data.quantity }));
    formData.set('sizes', JSON.stringify(data.sizes));

    const invalidData = validateProduct(data);
    if (invalidData)
        return toggleSubmitBtn();

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
        if (err) return console.log(err);
        Quagga.start();
        scanned = false;

        Quagga.onDetected(data => {
            if (scanned) return; // this is used because every time you init Quagga, it adds a new listener and starts duplicating events
            scanned = true;

            Quagga.stop();
            const barcode = data.codeResult.code;
            document.getElementById('barcode').value = barcode;
            successScan(document.getElementById('barcode')); // TODO Check if it works fine
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

export async function createEditProductPage(ctx, next) {
    try {
        if (ctx.params.id) {
            editPage = true;
            const req = await axios.get(`/products/${ctx.params.id}`);
            product = req.data;
            selectedSizes = product.sizes.map(s => s.size);
        } else {
            editPage = false;
            product = '';
            selectedSizes = [];
        }

        const keys = ['wholesaleMarkup', 'retailMarkup', 'deliveryPriceFields', 'wholesalePriceFields', 'retailPriceField'];
        const req = await axios.get('/settings', { params: { keys } });
        wholesaleMarkup = req.data.filter(s => s.key === 'wholesaleMarkup')[0].value;
        retailMarkup = req.data.filter(s => s.key === 'retailMarkup')[0].value;
        deliveryPriceFields = req.data.filter(s => s.key === 'deliveryPriceFields')[0].value;
        wholesalePriceFields = req.data.filter(s => s.key === 'wholesalePriceFields')[0].value;
        retailPriceField = req.data.filter(s => s.key === 'retailPriceField')[0].value;
    } catch (err) {
        console.error(err);
        alert('Възникна грешка')
    }

    const template = () => html`
        ${nav()}
<div class="container-fluid">
    <form enctype="multipart/form-data" novalidate @submit=${updateProduct} id="createProductForm" class="needs-validation p-2">
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
        <select class="form-select border-primary" name="category" id="category" required>
            ${until(loadCategories(), html`<option>Зареждане...</option>`)}
        </select>
    </div>

    <div class="row mb-3">
        <label for="name" class="form-label">Име</label>
        <input class="form-control border-primary" type="text" name="name" id="name" placeholder="Цветна тениска" .value=${product && product.name} required autocomplete="off">
    </div>

    <div class="row mb-3">
        <label for="description" class="form-label">Описание</label>
        <textarea class="form-control" name="description" id="description" rows="3" placeholder="Много готина тениска" .value=${product && product.description} autocomplete="off"></textarea>
</div>

                ${quantityTemplate()}

                ${pricesTemplate()}

                <div class="row mb-3">
                    <label for="code" class="form-label">Код</label>
                    <input class="form-control" type="text" name="code" id="code" .value=${product && product.code || ''} autocomplete="off">
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
                    <input class="form-check-input" type="checkbox" value="" name="hidden" id="hidden" ?disabled=${product} ?checked=${product?.hidden}>
                    <label class="form-check-label" for="hidden">
                        Скрит продукт (не се показва в сайта)
                    </label>
                </div>

                <div class="mb-3">
                    <input class="form-check-input" type="checkbox" value="" name="noInvoice" id="noInvoice" ?checked=${product?.noInvoice}>
                    <label class="form-check-label" for="noInvoice">
                        Продукт без фактура (може да се продава само в ПОС системата)
                    </label>
                </div>

                ${editPage ? "" : html`
                    <div class="mb-3">
                        <input class="form-check-input" type="checkbox" value="" name="printLabel" id="printLabel" checked>
                        <label class="form-check-label" for="printLabel">
                            Принтирай етикети
                        </label>
                    </div>`}

<div id="alert" class="d-none alert" role="alert"></div>
                ${['manager', 'admin'].includes(loggedInUser.role) ? submitBtn({ type: 'submit', icon: 'bi-check-lg', classes: 'd-block m-auto col-sm-3' }) : ''}
            </form >
        </div >
    `;

    render(template(), container);
    render(sizesTemplate(selectedSizes), document.getElementById('addedSizes'));

    // If product has images, render them
    if (product && product.additionalImages.length > 0)
        render(product.additionalImages.map(img => imgTemplate(img.url)), document.getElementById('additionalImagesPreview'));

    // If product has sizes, enable deliveryPricePerUnit
    if (selectedSizes.length)
        document.getElementById('deliveryPricePerUnit').disabled = false;
}