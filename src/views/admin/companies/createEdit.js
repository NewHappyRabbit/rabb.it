import { container } from "@/app.js";
import { markInvalid, markValid } from "@/api";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from "@/views/nav";
import { toggleSubmitBtn, submitBtn } from "@/views/components";
import { loggedInUser } from "@/views/login";

var company = '';

function validateCompany(data) {
    var invalidFlag = false;

    if (!data.name)
        invalidFlag = markInvalid('name');
    else markValid('name');

    if (!data.mol)
        invalidFlag = markInvalid('mol');
    else markValid('mol');

    if (!data.vat || data.vat.length !== 9)
        invalidFlag = markInvalid('vat');
    else markValid('vat');

    if (!data.tax || data.tax < 0 || data.tax > 100)
        invalidFlag = markInvalid('tax');
    else markValid('tax');

    if (!data.address)
        invalidFlag = markInvalid('address');
    else markValid('address');

    if (data.phone && data.phone.length > 15)
        invalidFlag = markInvalid('phone');
    else markValid('phone');

    if (!data.bank?.name)
        invalidFlag = markInvalid('bankName');
    else markValid('bankName');

    if (!data.bank?.code)
        invalidFlag = markInvalid('bankCode');
    else markValid('bankCode');

    if (!data.bank?.iban || data.bank.iban.length > 34)
        invalidFlag = markInvalid('bankIban');
    else markValid('bankIban');

    return invalidFlag;
}

async function createEditCompany(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = e.target;
    form.classList.add('was-validated');
    form.classList.remove('needs-validation')
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.bank = {
        name: data.bankName,
        code: data.bankCode,
        iban: data.bankIban,
    }

    const invalidData = validateCompany(data);
    if (invalidData) return toggleSubmitBtn();

    const alertEl = document.getElementById('alert');
    try {
        const req = company ? await axios.put(`/companies/${company._id}`, data) : await axios.post('/companies', data);

        if (req.status === 201) {
            toggleSubmitBtn();
            if (!company) {
                form.reset();
                document.querySelectorAll('input').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
            }
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');
            alertEl.classList.remove('d-none', 'alert-danger');
            alertEl.classList.add('alert-success');
            alertEl.textContent = `Фирмата е ${company ? 'редактирана' : 'създадена'} успешно.`;
        }
    } catch (err) {
        toggleSubmitBtn();
        if (err.response.status === 400) {
            alertEl.classList.remove('d-none', 'alert-success');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = err.response.data;
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');

            if (err.response.data.toLowerCase().includes('еик')) {
                markInvalid('vat');
            }

            if (err.response.data.toLowerCase().includes('телефон')) {
                markInvalid('phone');
            }

            if (err.response.data.toLowerCase().includes('данъчна')) {
                markInvalid('tax');
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

export async function createEditCompanyPage(ctx, next) {
    if (loggedInUser && loggedInUser.role !== 'admin')
        return page('/');

    const id = ctx.params.id;
    if (id) {
        try {
            const req = await axios.get(`/companies/${id}`);
            company = req.data;
        } catch (err) {
            console.error(err);
            alert('Възникна грешка');
        }
    } else company = '';

    const template = () => html`
        ${nav()}
        <div class="container-fluid">
            <form novalidate encytpe="multipart/form-data" @submit=${createEditCompany} class="row g-3 needs-validation">
                <div class="col-sm-6">
                    <label for="name" class="form-label">Фирма</label>
                    <input class="form-control border-primary" type="text" id="name" name="name" .value=${company && company.name} placeholder="пример: Сиско Трейд ЕТ" required autocomplete="off">
                </div>

                <div class="col-sm-6">
                    <label for="mol" class="form-label">МОЛ</label>
                    <input class="form-control border-primary" type="text" id="mol" name="mol" .value=${company && company.mol} placeholder="пример: Иван Иванов" required autocomplete="off">
                </div>

                <div class="col-sm-4">
                    <label for="vat" class="form-label">ЕИК</label>
                    <div class="input-group">
                        <input class="form-control border-primary" type="string" id="vat" name="vat" .value=${company && company.vat} placeholder="9 цифри" pattern="[0-9]{9}" inputmode="numeric" maxlength="9" required autocomplete="off">
                    </div>
                </div>

                <div class="col-sm-4">
                    <label for="taxvat" class="form-label">ДДС ЕИК</label>
                    <div class="input-group">
                        <input class="form-control" type="string" id="taxvat" name="taxvat" .value=${company?.taxvat || ''} placeholder="пример: BG123..." autocomplete="off">
                    </div>
                </div>

                <div class="col-sm-4">
                    <label for="taxvat" class="form-label">ДДС %</label>
                    <div class="input-group">
                        <input class="form-control" type="number" step="1" min="0" max="100" id="tax" name="tax" inputmode="numeric" .value=${company?.tax || 20} placeholder="пример: 20, 0, 10" autocomplete="off">
                    </div>
                </div>

                <div class="col-sm-6">
                    <label for="address" class="form-label">Адрес</label>
                    <input class="form-control border-primary" type="text" id="address" name="address" placeholder="пример: гр. Русе, ул. Шипка 44" .value=${company && company.address} required autocomplete="off">
                </div>

                <div class="col-sm-6">
                    <label for="phone" class="form-label">Телефон</label>
                    <input class="form-control" type="tel" id="phone" name="phone" maxlength="15" .value=${company && company.phone} placeholder="пример: 0891234567" autocomplete="off">
                </div>

                <div class="col-sm-4">
                    <label for="bankName" class="form-label">Банка</label>
                    <input class="form-control border-primary" type="text" id="bankName" name="bankName" .value=${company && company.bank.name} placeholder="пример: Райфайзен" required autocomplete="off">
                </div>

                <div class="col-sm-4">
                    <label for="bankCode" class="form-label">Код на банката</label>
                    <input class="form-control border-primary" type="text" id="bankCode" name="bankCode" .value=${company && company.bank.code} placeholder="пример: 123" required autocomplete="off">
                </div>

                <div class="col-sm-4">
                    <label for="bankIban" class="form-label">IBAN</label>
                    <input class="form-control border-primary" type="text" id="bankIban" name="bankIban" .value=${company && company.bank.iban} maxlength=34 placeholder="пример: BG12RZBB91551012345678" required autocomplete="off">
                </div>

                <div id="alert" class="d-none alert" role="alert"></div>
                ${submitBtn({ classes: 'd-block m-auto col-sm-3 mt-3', icon: 'bi-check-lg' })}
            </form>
        </div>
    `;

    render(template(), container);
}