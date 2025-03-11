import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { markInvalid, markValid, priceRegex, fixInputPrice } from "@/api";
import { nav } from "@/views/nav";
import { toggleSubmitBtn, submitBtn } from "@/views/components";
import { loggedInUser } from "@/views/login";
import page from 'page';
var customer = '';

function validateCustomer(data) {
    var invalidFlag = false;

    if (!data.name)
        invalidFlag = markInvalid('name');
    else markValid('name');

    if (data.vat && (data.vat.length > 15 || data.vat.length < 9))
        invalidFlag = markInvalid('vat');
    else markValid('vat');

    // if discount entered, check if format is X or X.Y or XY.Z (ex. 1 or 1.5 or 12.5)
    if (data.discount && (data.discount < 0 || data.discount > 100 || !priceRegex.test(data.discount)))
        invalidFlag = markInvalid('discount');
    else markValid('discount');

    return invalidFlag;
}

async function createEditCustomer({ e, modal = false, alertElId = 'alert', functionToRunOnSuccess }) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = e.target;
    form.classList.add('was-validated');
    form.classList.remove('needs-validation')
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const invalidData = validateCustomer(data);
    if (invalidData)
        return toggleSubmitBtn();

    const alertEl = document.getElementById(alertElId);
    try {
        const req = customer ? await axios.put(`/customers/${customer._id}`, data) : await axios.post('/customers', data);
        if (req.status === 201) {
            if (modal === true)
                functionToRunOnSuccess && functionToRunOnSuccess(req.data);

            toggleSubmitBtn();

            if (!customer)
                form.reset();
            document.querySelectorAll('input').forEach(el => el.classList.remove('is-valid', 'is-invalid'));

            form.classList.remove('was-validated');
            form.classList.add('needs-validation');
            alertEl.classList.remove('d-none', 'alert-danger');
            alertEl.classList.add('alert-success');
            alertEl.textContent = `Клиентът е ${customer ? 'редактиран' : 'създаден'} успешно.`;
        }

    } catch (err) {
        toggleSubmitBtn();
        if (err.response.status === 400) {
            alertEl.classList.remove('d-none', 'alert-success');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = err.response.data;
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');

            if (err.response.data.toLowerCase().includes('ддс еик')) {
                markInvalid('taxvat');
            } else if (err.response.data.toLowerCase().includes('еик')) {
                markInvalid('vat');
            }

            if (err.response.data.toLowerCase().includes('телефон')) {
                markInvalid('phone');
            }

            if (err.response.data.toLowerCase().includes('отстъпка')) {
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

export const customerForm = ({ customer, modal = false, alertElId, functionToRunOnSuccess }) => html`
<form novalidate @submit=${(e) => createEditCustomer({ e, modal, alertElId, functionToRunOnSuccess })} class="row g-3 needs-validation">
    <div class="col-sm-6">
        <label for="name" class="form-label">Фирма/Име</label>
        <input class="form-control border-primary" type="text" id="name" name="name" .value=${customer?.name || ''} placeholder="пример: Сиско Трейд ЕТ" required autocomplete="off">
    </div>

    <div class="col-sm-6">
        <label for="mol" class="form-label">МОЛ/Име</label>
        <input class="form-control" type="text" id="mol" name="mol" .value=${customer?.mol || ''} placeholder="пример: Иван Иванов" autocomplete="off">
    </div>

    <div class="col-sm-6">
        <label for="vat" class="form-label">ЕИК/ЕГН</label>
        <div class="input-group">
            <input class="form-control" type="text" id="vat" name="vat" .value=${customer?.vat || ''} placeholder="9-15 цифри" pattern="[0-9]{9,15}" inputmode="numeric" maxlength="15" autocomplete="off">
        </div>
    </div>

    <div class="col-sm-6">
        <label for="taxvat" class="form-label">ДДС ЕИК</label>
        <div class="input-group">
            <input class="form-control" type="text" id="taxvat" name="taxvat" placeholder="пример: BG117...." .value=${customer?.taxvat || ''} autocomplete="off">
        </div>
    </div>

    <div class="col-sm-6">
        <label for="address" class="form-label">Адрес</label>
        <input class="form-control" type="text" id="address" name="address" placeholder="пример: гр. Русе, ул. Шипка 44" .value=${customer?.address || ''} autocomplete="off">
    </div>

    <div class="col-sm-6">
        <label for="deliveryAddress" class="form-label">Адрес за доставка</label>
        <input class="form-control" type="text" id="deliveryAddress" name="deliveryAddress" placeholder="пример: гр. Русе, ул. Шипка 44, офис на Спиди" .value=${customer?.deliveryAddress || ''} autocomplete="off">
    </div>

    <div class="col-sm-6">
        <label for="phone" class="form-label">Телефон</label>
        <input class="form-control" type="tel" id="phone" name="phone" maxlength="15" .value=${customer?.phone || ''} placeholder="пример: 0891234567" autocomplete="off">
    </div>

    <div class="col-sm-6">
        <label for="email" class="form-label">Имейл</label>
        <input class="form-control" type="email" id="email" name="email" .value=${customer?.email || ''} placeholder="пример: rado@abv.bg" autocomplete="off">
    </div>

    <div class="mb-3">
        <label for="discount" class="form-label">Отстъпка %</label>
        <input @keyup=${(e) => fixInputPrice({ target: e.target })} class="form-control" type="text" id="discount" name="discount" inputmode="decimal" .value=${customer?.discount || ''} autocomplete="off">
    </div>

    ${submitBtn({ classes: 'd-block m-auto col-sm-3', icon: 'bi-check-lg', type: "submit" })}
</form>
`;

export async function createEditCustomerPage(ctx, next) {
    const id = ctx.params.id;
    if (id) {
        if (!['manager', 'admin'].includes(loggedInUser.role))
            return page('/');

        try {
            const req = await axios.get(`/customers/${id}`);
            customer = req.data;
        } catch (err) {
            console.error(err);
            alert('Възникна грешка');
        }
    } else customer = '';

    const template = () => html`
        ${nav()}
        <div class="container-fluid">
            ${customerForm({ customer })}
            <div id="alert" class="d-none alert" role="alert"></div>
        </div>
    `;

    render(template(), container);
}