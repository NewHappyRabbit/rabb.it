import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from '@/views/nav.js';
import { markValid, markInvalid } from '@/api.js'
import { toggleSubmitBtn, submitBtn } from "@/views/components";


async function saveSettings(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const alertEl = document.getElementById('alert');
    const invalidData = validateSettings(data);
    if (invalidData) return toggleSubmitBtn();

    form.classList.add('was-validated');
    form.classList.remove('needs-validation');

    try {
        const req = await axios.put('/settings', data);

        if (req.status === 201) {
            toggleSubmitBtn();
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');
            alertEl.classList.remove('d-none', 'alert-danger');
            alertEl.classList.add('alert-success');
            alertEl.textContent = `Всичко е запаметено успешно.`;
        }

    } catch (err) {
        toggleSubmitBtn();
        if (err.response.status === 400) {
            alertEl.classList.remove('d-none', 'alert-success');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = err.response.data;
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');

            if (err.response.data.toLowerCase().includes('едро')) {
                markInvalid('wholesaleMarkup');
            }

            if (err.response.data.toLowerCase().includes('дребно')) {
                markInvalid('retailMarkup');
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

function validateSettings(data) {
    var invalidFlag = false;

    if (!data.wholesaleMarkup)
        invalidFlag = markInvalid('wholesaleMarkup');
    else markValid('wholesaleMarkup');

    if (!data.retailMarkup)
        invalidFlag = markInvalid('retailMarkup');
    else markValid('retailMarkup');

    return invalidFlag;
}

export async function settingsPage() {
    var settings, orderParams;
    try {
        settings = (await axios.get('/settings')).data;
        orderParams = (await axios.get('/orders/params')).data;
        console.log(orderParams)
    } catch (error) {
        console.error(error);
        alert('Възникна грешка')
    }

    const template = () => html`
        ${nav()}
        <div class="container-fluid">
            <form novalidate @submit=${saveSettings} class="needs-validation" autocomplete="off">
                <h3>Продукти</h3>
                <div class="row">
                    <div class="col-6 col-sm-3">
                        <label for="wholesaleMarkup" class="form-label">Надценка на едро</label>
                        <div class="input-group mb-3">
                            <input type="number" min="0" inputmode="numeric" class="form-control" .value=${settings.find(k => k.key == "wholesaleMarkup").value} id="wholesaleMarkup" name="wholesaleMarkup" required>
                            <span class="input-group-text">%</span>
                        </div>
                    </div>

                    <div class="col-6 col-sm-3">
                        <label for="wholesaleMarkup" class="form-label">Надценка на дребно</label>
                        <div class="input-group mb-3">
                            <input type="number" min="0" inputmode="numeric" class="form-control" .value=${settings.find(k => k.key == "retailMarkup").value} id="retailMarkup" name="retailMarkup" required>
                            <span class="input-group-text">%</span>
                        </div>
                    </div>

                    <div class="col-6 col-sm-3">
                        <label for="deliveryPriceFields" class="form-label">При създаване на артикул ще са видими следните полета за доставна цена</label>
                        <select class="form-select" id="deliveryPriceFields" name="deliveryPriceFields" required>
                            <option ?selected=${settings.find(k => k.key == "deliveryPriceFields").value == "whole"} value="whole">Доставна цена</option>
                            <option ?selected=${settings.find(k => k.key == "deliveryPriceFields").value == "unit"} value="unit">Доставна цена за брой</option>
                            <option ?selected=${settings.find(k => k.key == "deliveryPriceFields").value == "both"} value="both">Доставна цена + доставна цена за брой</option>
                        </select>
                    </div>

                    <div class="col-6 col-sm-3">
                        <label for="wholesalePriceFields" class="form-label">При създаване на артикул ще са видими следните полета за цена на едро</label>
                        <select class="form-select" id="wholesalePriceFields" name="wholesalePriceFields" required>
                            <option ?selected=${settings.find(k => k.key == "wholesalePriceFields").value == "whole"} value="whole">Цена на едро</option>
                            <option ?selected=${settings.find(k => k.key == "wholesalePriceFields").value == "unit"} value="unit">Цена на едро за брой</option>
                            <option ?selected=${settings.find(k => k.key == "wholesalePriceFields").value == "both"} value="both">Цена на едро + цена на едро за брой</option>
                        </select>
                    </div>

                    <div class="col-6 col-sm-3">
                        <label for="deliveryPriceFields" class="form-label">При създаване на артикул, ще бъде ли видимо полето за цена на дребно?</label>
                        <select class="form-select" id="retailPriceField" name="retailPriceField" required>
                            <option ?selected=${settings.find(k => k.key === "retailPriceField").value === "true"} value="true">Да</option>
                            <option ?selected=${settings.find(k => k.key === "retailPriceField").value === "false"} value="false">Не</option>
                        </select>
                    </div>
                </div>


                <h3 class="mt-5">Продажби</h3>
                <div class="row">
                    <div class="col-6 col-sm-3">
                        <label for="orderType" class="form-label">Тип на продажба по подразбиране</label>
                        <select class="form-select" id="orderType" name="orderType" required>
                            ${Object.entries(orderParams.orderTypes).map(([key, value]) => html`<option value=${key} ?selected=${settings.find(k => k.key == "orderType").value == key}>${value}</option>`)}
                        </select>
                    </div>

                    <div class="col-6 col-sm-3">
                        <label for="paymentType" class="form-label">Начин на плащане по подразбиране</label>
                        <select class="form-select" id="paymentType" name="paymentType" required>
                            ${Object.entries(orderParams.paymentTypes).map(([key, value]) => html`<option value=${key} ?selected=${settings.find(k => k.key == "paymentType").value == key}>${value}</option>`)}
                        </select>
                    </div>

                    <div class="col-6 col-sm-3">
                        <label for="documentType" class="form-label">Тип на документ по подразбиране</label>
                        <select class="form-select" id="documentType" name="documentType" required>
                            ${Object.entries(orderParams.documentTypes).map(([key, value]) => html`<option value=${key} ?selected=${settings.find(k => k.key == "documentType").value == key}>${value}</option>`)}
                        </select>
                    </div>

                    <div class="col-6 col-sm-3">
                        <label for="orderPrint" class="form-label">Принтиране на документ при продажба</label>
                        <select class="form-select" id="orderPrint" name="orderPrint" required>
                            <option value="original">Само оригинал</option>
                            <option value="originalCopy">Оригинал + Копие</option>
                            <option value="originalCopyStokova">Оригинал + Копие + Стокова</option>
                        </select>
                    </div>
                </div>

                <h3>WooCommerce</h3>
                <div class="row">
                    <div class="col-6 col-sm-3">

                    </div>
                </div>

                <div id="alert" class="d-none alert mb-2" role="alert"></div>
                ${submitBtn({ text: "Запази всички настройки", icon: "bi-check-lg", classes: "d-block m-auto mt-3 col-sm-3" })}
            </form>
        </div>
    `;

    render(template(), container);
}