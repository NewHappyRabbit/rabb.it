import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import page from 'page';
import { until } from "lit/directives/until.js";
import { nav } from "@/views/nav";
import { spinner } from "@/views/components";

var selectedCompany;

async function deleteCompany() {
    try {
        const req = await axios.delete(`/companies/${selectedCompany}`);

        if (req.status === 204) {
            //close modal
            const modal = document.getElementById('deleteModal');
            const modalInstance = bootstrap.Modal.getInstance(modal);
            modalInstance.hide();
            page('/admin/companies');

        }
    } catch (err) {
        if (err.response.status === 400)
            alert(err.response.data);
    }
}

async function setDefault(_id) {
    try {
        const req = await axios.put(`/companies/${_id}/default`);

        if (req.status === 201)
            page('/admin/companies');
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}

const companyRow = (company) => html`
    <tr .id=${company._id}>
        <td>${company.name} ${company.default ? html`<i class="bi bi-star-fill text-warning"></i>` : ''}</td>
        <td>${company.vat}</td>
        <td class="text-nowrap">
            <button @click=${() => setDefault(company._id)} class="btn btn-primary" .disabled=${company.default}><i class="bi bi-star-fill"></i><span class="d-none d-sm-inline"> Задай по подразбиране</span></button>
            <a class="btn btn-secondary" href=${`/admin/companies/${company._id}`}><i class="bi bi-pencil"></i><span class="d-none d-sm-inline"> Редактирай</span></a>
            <div class="d-inline" data-bs-toggle=${company.canBeDeleted ? 'tooltip' : ''} data-bs-title=${company.canBeDeleted ? 'Тази фирма не може да се изтрие, защото има продажби' : ''}>
                <button @click=${() => selectedCompany = company._id} ?disabled=${company.canBeDeleted} class="btn btn-danger"  data-bs-target="#deleteModal" data-bs-toggle=${company.canBeDeleted ? '' : 'modal'}><i class="bi bi-trash"></i><span class="d-none d-sm-inline"> Изтрий</span></button>
            </div>
        </td>
    </tr>
`;
const table = (companies) => html`
    <div class="table-responsive">
        <table class="mt-3 table table-striped table-hover text-center">
            <thead>
                <tr>
                    <th scope="col">Фирма</th>
                    <th scope="col">ЕИК</th>
                    <th scope="col">Действия</th>
                </tr>
            </thead>
            <tbody>
                ${companies ? companies.map(companyRow) : ''}
            </tbody>
        </table>
    </div>
`;

async function loadCompanies() {
    try {
        const companies = (await axios.get('/companies?canBeDeleted=true')).data.companies;

        setTimeout(() => {
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
            if (tooltipTriggerList.length)
                [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
        }, 300);
        return table(companies);
    } catch (err) {
        console.error(err);
        alert('Възникна грешка');
    }
}


export async function companiesPage() {
    const deleteModal = () => html`
    <div class="modal fade" id="deleteModal" tabindex="-1" aria-labelledby="deleteModalLabel" aria-hidden="true" >
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="deleteModalLabel">Изтрий фирма</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    Ако фирмата има издадени документи, тя няма да може да бъде изтрита. Сигурни ли сте че искате да изтриете тази фирма?
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Откажи</button>
                    <button @click=${deleteCompany} type="button" class="btn btn-danger">Изтрий</button>
                </div>
            </div>
        </div>
    </div>`;

    const template = () => html`
        ${deleteModal()}
        ${nav()}
        <div class="container-fluid">
            <a href='/admin/companies/create' class="btn btn-primary"><i class="bi bi-plus"></i> Създай фирма</a>
            ${until(loadCompanies(), spinner)}
        </div>
    `;

    render(template(), container);
}