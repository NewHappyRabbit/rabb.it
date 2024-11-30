import { container } from "@/app.js";
import '@/css/categories.css';
import { html, render } from 'lit/html.js';
import axios from "axios";
import page from 'page';
import { nav } from '@/views/nav.js';
import { markInvalid, markValid, loadPreviewImage } from "@/api.js";
import { until } from 'lit/directives/until.js';
import { spinner } from "@/views/components";
import { loggedInUser } from "@/views/login";

var selectedCategoryId;
var formOptions;
var categories;

function renderCategories(categories) {
    // add depth value
    for (let category of categories)
        category.depth = category.path ? category.path.split(',').filter(function (el) {
            return el != "";
        }) : [];

    const parentCategories = categories.filter(cat => !cat.path);

    const categoryTemplate = (category) => html`
        <div class="list-group">
            <div class="list-group-item depth depth-${category.depth.length}" slug="${category.slug}" path="${category.path}" order="${category.order}">
                ${['manager', 'admin'].includes(loggedInUser.role) ? html`<button class="btn" data-bs-toggle="modal" data-bs-target="#createEditModal" @click=${() => renderForm(category)}>${category.name}</button>` : html`<button class="btn" >${category.name}</button>`}
                ${categories.filter(cat => cat.path == `${category.path}${category.slug},` || cat.path == `,${category.slug},`).map(child => categoryTemplate(child))}
            </div>
        </div>`;

    const allParentHTML = () => html`
        ${parentCategories.map(cat => categoryTemplate(cat))}
    `;

    return allParentHTML();
}

function validateCategory(data) {
    var invalidFlag = false;

    if (!data.name)
        invalidFlag = markInvalid('name');
    else markValid('name');

    // if data.order, check if its a whole number (ex. 1,5,55 but not 1.5, 0.5)
    if (data.order && data.order.match(/^\d+$/) === null)
        invalidFlag = markInvalid('order');
    else markValid('order');

    return invalidFlag;
}

function resetForm() {
    const form = document.querySelector('#createEditModal form');
    const alertEl = document.getElementById('alert');
    form.reset();
    form.querySelectorAll('input').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
    form.querySelectorAll('select').forEach(el => el.classList.remove('is-valid', 'is-invalid'));
    form.classList.remove('was-validated');
    form.classList.add('needs-validation');
    alertEl.classList.remove('alert-danger');
    alertEl.classList.add('d-none');
    alertEl.textContent = '';

}

async function createEditDeleteCategory(e) {
    e.preventDefault();
    const form = document.querySelector('#createEditModal form');
    e.target.disabled = true;
    const action = e.target.getAttribute('action');

    form.classList.add('was-validated');
    form.classList.remove('needs-validation')
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const invalidData = validateCategory(data);
    if (invalidData) return e.target.disabled = false;

    const alertEl = document.getElementById('alert');
    try {
        var req;
        console.log({ action, selectedCategoryId })
        if (action === 'delete')
            req = await axios.delete(`/categories/${selectedCategoryId}`);
        else if (action === 'edit')
            req = await axios.put(`/categories/${selectedCategoryId}`, formData);
        else
            req = await axios.post('/categories', formData);

        if ([201, 204].includes(req.status)) {
            renderForm();
            resetForm();
            document.querySelector('#createEditModal [data-bs-dismiss="modal"]').click();
            e.target.disabled = false;
            return page('/categories');
        }
    } catch (err) {
        e.target.disabled = false;
        console.error(err);
        if (err.response.status === 400) {
            alertEl.classList.remove('d-none');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = err.response.data;
            form.classList.remove('was-validated');
            form.classList.add('needs-validation');

            if (err.response.data.toLowerCase().includes('name'))
                markInvalid('name');
            if (err.response.data.toLowerCase().includes('parent'))
                markInvalid('parent');
            if (err.response.data.toLowerCase().includes('order'))
                markInvalid('order');
        }
        else if (err.response.status === 500) {
            alertEl.classList.remove('d-none');
            alertEl.classList.add('alert-danger');
            alertEl.textContent = 'Грешка в сървъра';
            console.error(err);
        }
    }
}

const createEditModal = () => html`
    <div class="modal fade" id ="createEditModal" tabindex="-1" aria-labelledby="createEditModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="createEditModalLabel">Създай/Редактирай категория</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <form enctype="multipart/form-data" novalidate class="needs-validation">
                </form>
            </div>
        </div>
    </div>`;

const modalForm = (category) => html`
    <div class="modal-body">
        <div class="mb-3">
            <label for="name" class="form-label">Име</label>
            <input type="text" class="form-control" name="name" .value=${category && category.name} id="name" autocomplete="off" required>
        </div>
        <div class="mb-3">
            <label for="parent" class="form-label">Родителска категория</label>
            <select class="form-select" name="parent" id="parent">
                ${formOptions}
            </select>
        </div>
        <div class="row mb-3">
            <label for="image" class="form-label">Снимка</label>
            <input @change=${loadPreviewImage} name="image" class="form-control" type="file" id="image" accept="capture=camera,image/*">
            <img id="imagePreview" class="${category?.image ? '' : 'd-none'} img-thumbnail" .src=${category?.image?.url} alt="">
        </div>
        <div class="mb-3">
            <label for="order" class="form-label">Подредба</label>
            <input type="number" min="0" step="1" inputmode="numeric" value=${category && category.order} class="form-control" name="order" id="order" placeholder="0" autocomplete="off">
        </div>
        <div id="alert" class="d-none alert" role="alert"></div>
    </div>
    <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Откажи</button>
        ${category && loggedInUser.role === 'admin' ? html`<button type="submit" action="delete" @click=${createEditDeleteCategory} class="btn btn-danger">Изтрий</button>` : ''}
        <button type="submit" action=${category ? "edit" : "create"} @click=${createEditDeleteCategory} class="btn btn-primary"><i class="bi bi-check-lg"></i> Запази</button>
    </div>
`;

export function categoriesOptions(params) {
    const { categories, selected, showNoParent = true, disableWithChilden = false } = params;
    // disableWithChilden - disable category if it has children (for selection in product creation)

    // add depth value
    for (let category of categories)
        category.depth = category.path ? category.path.split(/\w,\w/gm).filter(function (el) {
            return el != "";
        }) : [];

    const parentCategories = categories.filter(cat => !cat.path);

    var options = showNoParent ? [html`<option value="">Без категория</option>`] : [html`<option disabled ?selected=${!selected} value="">Избери категория</option>`];
    const option = (category) => html`<option ?disabled=${disableWithChilden && categories.some(cat => cat.path?.includes(',' + category.slug + ','))} .selected=${selected && selected == category._id.toString()} slug="${category.slug}" value="${category._id}">${category.depth.map(() => '-').join(' ')}${category.name}</option>`;

    function recursion(category) {
        options.push(option(category));
        const children = categories.filter(cat => cat.path == `${category.path}${category.slug},` || cat.path == `,${category.slug},`);

        if (children)
            children.forEach(child => recursion(child));
    }
    parentCategories.forEach(category => {
        recursion(category);
    });

    return options;
}

function renderForm(category) {
    selectedCategoryId = category ? category._id : null;
    const options = {
        categories,
    }

    if (category && category.path) {
        // Find parent category id by slug to select in Parent menu
        let parentSlug = category.path.split(',');
        parentSlug = parentSlug[parentSlug.length - 2];
        options.selected = categories.find(category => category.slug === parentSlug)._id;
    }
    formOptions = categoriesOptions(options);

    render(modalForm(category ? category : null), document.querySelector('#createEditModal form'))

    if (!category) return;

    // Find currently selected category and disable option element
    const optionEl = document.querySelector(`#parent option[value="${category._id}"]`);
    optionEl.disabled = true;
}

export async function categoriesPage() {
    selectedCategoryId = null;
    async function loadCategories() {
        const req = await axios.get('/categories');
        categories = req.data;

        formOptions = categoriesOptions({ categories });
        return renderCategories(categories);
    }

    const template = () => html`
        <div class="container-responsive">
            ${createEditModal()}
            ${nav()}
            ${['manager', 'admin'].includes(loggedInUser.role) ? html`<button data-bs-toggle="modal" data-bs-target="#createEditModal" @click=${() => renderForm()} class="btn btn-primary"><i class="bi bi-plus"></i> Създай категория</button>` : ''}
            <div id="categories" class="container-fluid mt-2">
                ${until(loadCategories(), spinner)}
            </div>
        </div>
    `;

    render(template(), container);
}