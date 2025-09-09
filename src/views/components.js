import { html } from 'lit-html';

export const spinner = html`
    <div class="position-absolute top-50 start-50 translate-middle">
        <div class="spinner-border text-primary" role="status" style="width: 5rem; height: 5rem;"><span class="visually-hidden">Зареждане...</span></div>
    </div>
`;

const btnSpinner = html`
    <div id="btnSpinner"  class="d-none position-absolute top-50 start-50 translate-middle">
        <div class="spinner-border" role="status"></div>
    </div>
`;

export function toggleSubmitBtn(target) {
    // if target is span, target parent
    if (target && target.tagName === 'SPAN') target = target.parentNode;
    const submitBtn = target || document.getElementById('submitBtn');
    const submitBtnText = target ? target.querySelector('span') : document.querySelector('#submitBtn span');
    const submitBtnSpinner = target ? target.querySelector('#btnSpinner') : document.getElementById('btnSpinner');

    if (submitBtn.disabled === false) {
        submitBtn.disabled = true;
        submitBtnText.classList.add('opacity-0');
        submitBtnSpinner.classList.remove('d-none');
    } else {
        submitBtn.disabled = false;
        submitBtnText.classList.remove('opacity-0');
        submitBtnSpinner.classList.add('d-none');
    }
}

export const submitBtn = ({ func, classes, icon, text = 'Запази', type = 'submit', id = 'submitBtn', disabled = false, style = "" }) => html`
    <button style="${style}" ?disabled=${disabled} id="${id}" @click=${func} type=${type} class="btn btn-primary position-relative ${classes}">${btnSpinner}<span class="pe-none">${icon ? html`<i class="bi ${icon}"></i> ` : ''}${text}</span></button>
`;