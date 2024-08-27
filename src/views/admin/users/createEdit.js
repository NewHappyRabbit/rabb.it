import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { nav } from "@/views/nav.js";
import { markValid, markInvalid } from "@/api.js";
import { toggleSubmitBtn, submitBtn } from "@/views/components";
import { loggedInUser } from "@/views/login";

var user = '', userRoles;

function validateUser(data, user) {
    var invalidFlag = false;

    if (!data.username)
        invalidFlag = markInvalid('username');
    else markValid('username');

    if (user && !data.password && !data.password2) {
        markValid('password');
        markValid('password2');
    } else {
        if (!data.password || data.password.length < 6)
            invalidFlag = markInvalid('password');
        else markValid('password');

        if (!data.password2 || data.password !== data.password2)
            invalidFlag = markInvalid('password2');
        else markValid('password2');
    }

    return invalidFlag;
}

async function createEditUser(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const alertEl = document.getElementById('alert');
    const invalidData = validateUser(data, user);
    if (invalidData) return toggleSubmitBtn();;

    form.classList.add('was-validated');
    form.classList.remove('needs-validation');

    try {
        const req = user ? await axios.put(`/users/${user._id}`, data) : await axios.post('/users', data);

        if (req.status === 201) {
            toggleSubmitBtn();
            if (!user)
                form.reset();

            document.querySelectorAll('input').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');
            alertEl.classList.remove('d-none', 'alert-danger');
            alertEl.classList.add('alert-success');
            alertEl.textContent = `Потребителят е ${user ? 'редактиран' : 'създаден'} успешно.`;
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

export async function createEditUserPage(ctx, next) {
    const id = ctx.params.id;
    userRoles = await axios.get('/users/roles').then(res => res.data);
    if (id) {
        try {
            const req = await axios.get(`/users/${id}`);
            user = req.data;
        } catch (err) {
            console.error(err);
            alert('Възникна грешка');
        }
    } else user = '';

    const template = () => html`
        ${nav()}
        <div class="container-fluid">
            <form novalidate @submit=${createEditUser} class="needs-validation" autocomplete="off">
                <div class="row justify-content-center mb-2">
                    <div class="col-sm-3">
                        <label for="username" class="form-label">Потребителско име</label>
                        <input class="form-control" type="text" id="username" name="username" .value=${user && user.username} placeholder="пример: ivan12" required autocomplete="off">
                    </div>
                </div>
                <div class="row justify-content-center mb-2">
                    <div class="col-sm-3">
                        <label for="password" class="form-label">Парола (мин. 6 символа)</label>
                        <input class="form-control" type="password" id="password" name="password" ?minlength=${!user || 6} ?required=${!user} autocomplete="off">
                    </div>
                </div>
                <div class="row justify-content-center mb-2">
                    <div class="col-sm-3">
                        <label for="password2" class="form-label">Повтори парола</label>
                        <input class="form-control" type="password" id="password2" name="password2" ?minlength=${!user || 6} ?required=${!user} autocomplete="off">
                    </div>
                </div>
                <div class="row justify-content-center mb-2">
                    <div class="col-sm-3">
                        <label for="role" class="form-label">Роля</label>
                        <select class="form-select" id="role" name="role" required>
                            ${Object.entries(userRoles).map(role => html`<option value=${role[0]} ?selected=${user && user.role === role[0]}>${role[1]}</option>`)}
                        </select>
                    </div>
                </div>
                <div id="alert" class="d-none alert mb-2" role="alert"></div>
                ${submitBtn({ classes: 'd-block m-auto col-sm-3', icon: 'bi-check-lg' })}
            </form>
        </div>
    `;

    render(template(), container);
}