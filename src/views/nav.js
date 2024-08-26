import { html, render } from 'lit-html';
import { logout, loggedInUser } from '@/views/login';
import { toggleDarkMode } from '@/api.js';
import { printerClass, printerModal, availablePrinters } from '@/printer';
import axios from 'axios';

const printerModalDiv = document.getElementById('selectPrinterModalDiv');

if (printerModalDiv)
    render(printerModal(availablePrinters), printerModalDiv);

async function downloadProductsURLS(e) {
    e.target.disabled = true;
    const response = await axios.get('/products/woourls')

    if (response.status === 200) {
        // download file
        const link = document.createElement("a");
        link.href = 'urls.txt';
        link.download = 'urls.txt';
        link.click();
    } else if (response.status === 204)
        alert('Сървърът не е свързан с WooCommerce!')

    e.target.disabled = false;
}

export const nav = () => html`
    <div id="selectPrinterModalDiv"></div>
    <nav class="navbar sticky-top navbar-expand-md bg-body-tertiary mb-2 d-print-none">
        <div class="container-fluid">
            <a class="navbar-brand" href="/">
                <img src="favicon/favicon-32x32.png" alt="Logo" width="30" height="24" class="d-inline-block align-text-top d-none">Rabb.it <span class="fw-light fs-6">(${loggedInUser && loggedInUser.username})</span> <i id="printerIconNav" data-bs-toggle="modal" data-bs-target="#selectPrinterModal" class="bi bi-printer ${printerClass}"></i> <i class="bi bi-wordpress"></i></a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar" aria-controls="navbar" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse justify-content-end" id="navbar">
                <ul class="navbar-nav g-3 text-center mb-lg-0">
                    ${loggedInUser && loggedInUser.role === 'admin' ? html`<li class="nav-item dropdown">
                        <a class="nav-link link-primary dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-shield-lock"></i> Админ</a>
                        <ul class="dropdown-menu dropdown-menu-md-end">
                            <li><a class="dropdown-item link-primary" href="/admin/users"><i class="bi bi-people"></i> Потребители</a></li>
                            <li><a class="dropdown-item link-primary" href="/admin/companies"><i class="bi bi-building"></i> Обекти</a></li>
                            <li><a class="dropdown-item link-primary" href="/admin/settings"><i class="bi bi-gear"></i> Настройки</a></li>
                        </ul>
                    </li>` : ''}
                    <li class="nav-item">
                        <a class="nav-link" href="/products"><i class="bi bi-box-seam"></i> Стоки</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/sales/create"><i class="bi bi-plus"></i> Създай продажба</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/sales"><i class="bi bi-cart"></i> Продажби</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/customers"><i class="bi bi-people"></i> Партньори</a>
                    </li>
                    ${loggedInUser && ['manager', 'admin'].includes(loggedInUser.role) ? html`
                        <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bi bi-file-earmark-text"></i> Справки
                        </a>
                        <ul class="dropdown-menu dropdown-menu-md-end">
                            <li><a class="dropdown-item" href="/references/sales"><i class="bi bi-file-earmark-text"></i> Справка по продажби</a></li>
                        </ul>
                    </li>` : ''}
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Други
                        </a>
                        <ul class="dropdown-menu dropdown-menu-md-end">
                            <li><button class="dropdown-item" @click=${toggleDarkMode}><i class="bi bi-moon"></i> Тъмен режим</button></li>
                            <li><a class="dropdown-item" href="/categories"><i class="bi bi-tags"></i> Категории</a></li>
                            ${loggedInUser && ['manager', 'admin'].includes(loggedInUser.role) ? html`<li><button class="dropdown-item" @click=${downloadProductsURLS}><i class="bi bi-download"></i> Линкове за продуктите</button></li>` : ''}
                        </ul>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link link-danger" @click=${logout} href="#"><i class="bi bi-box-arrow-left"></i> Изход</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
`;