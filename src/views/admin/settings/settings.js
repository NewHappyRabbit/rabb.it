import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from '@/views/nav.js';
import { markValid, markInvalid } from '@/api.js'
import { toggleSubmitBtn, submitBtn } from "@/views/components";
import { loggedInUser } from "@/views/login";


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
        else if (err.response.status === 500) {
            alertEl.classList.remove('d-none', 'alert-success');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = 'Грешка в сървъра';
            console.error(err);
        }
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
    var settings;
    try {
        const req = await axios.get('/settings');
        settings = req.data;
    } catch (error) {
        console.error(error);
        alert('Възникна грешка')
    }

    const template = () => html`
        ${nav()}
        <div class="container-fluid">
            <form novalidate @submit=${saveSettings} class="needs-validation" autocomplete="off">
                <h3>Общи</h3>
                <div class="row">
                    <div class="col-3">
                        <label for="wholesaleMarkup" class="form-label">Надценка на едро</label>
                        <div class="input-group mb-3">
                            <input type="number" min="0" inputmode="numeric" class="form-control" .value=${settings.filter(k => k.key == "wholesaleMarkup")[0]?.value || ''} id="wholesaleMarkup" name="wholesaleMarkup" required>
                            <span class="input-group-text">%</span>
                        </div>
                    </div>
                    <div class="col-3">
                        <label for="wholesaleMarkup" class="form-label">Надценка на дребно</label>
                        <div class="input-group mb-3">
                            <input type="number" min="0" inputmode="numeric" class="form-control" .value=${settings.filter(k => k.key == "retailMarkup")[0]?.value || ''} id="retailMarkup" name="retailMarkup" required>
                            <span class="input-group-text">%</span>
                        </div>
                    </div>
                    <div class="col-3">
                        <label for="labelPrinterIP" class="form-label">IP на етикетен принтер</label>
                        <input type="text" class="form-control" .value=${settings.filter(k => k.key == "labelPrinterIP")[0]?.value || ''} id="labelPrinterIP" name="labelPrinterIP">
                    </div>
                </div>
                <div id="alert" class="d-none alert mb-2" role="alert"></div>
                ${submitBtn({ text: "Запази всички настройки", icon: "bi-check-lg", classes: "d-block m-auto col-sm-3" })}
            </form>
        </div>
    `;

    render(template(), container);
}