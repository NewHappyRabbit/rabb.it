import { html, render } from 'lit-html';
import { logout, loggedInUser } from '@/views/login';
import { toggleDarkMode } from '@/api.js';
import { printerFound, printerModal, availablePrinters } from '@/printer';
import axios from 'axios';

const printerModalDiv = document.getElementById('selectPrinterModalDiv');

if (printerModalDiv)
    render(printerModal(availablePrinters), printerModalDiv);

async function downloadProductsURLS({ hidden = false, woo = false }) {
    const downloadBtns = document.querySelectorAll('.download-urls');
    downloadBtns.forEach(btn => btn.disabled = true);

    const selectedProductsNodes = document.querySelectorAll('.selectedProductCheckbox:checked');
    const selectedProducts = Array.from(selectedProductsNodes).map(node => node.closest('tr').getAttribute('id'));
    const data = {
        woo,
        hidden,
        ids: selectedProducts
    }

    const response = await axios.post('/products/woourls', data);

    if (response.status === 200) {
        // download file
        const link = document.createElement("a");
        link.href = 'urls.txt';
        link.download = 'urls.txt';
        link.click();
    } else if (response.status === 204)
        alert('Сървърът не е свързан с WooCommerce!')

    downloadBtns.forEach(btn => btn.disabled = false);
}

export const nav = () => html`
    <div id="selectPrinterModalDiv"></div>
    <nav class="navbar sticky-top navbar-expand-md bg-body-tertiary mb-2 d-print-none">
        <div class="container-fluid gap-4">
            <a class="navbar-brand" href="/">
                Rabb.it <span class="fw-light fs-6">(${loggedInUser && loggedInUser.username})</span> <i id="printerIconNav" data-bs-toggle="modal" data-bs-target="#selectPrinterModal" class="bi bi-printer ${printerFound === undefined ? 'text-warning' : printerFound ? 'text-success' : 'text-danger'}"></i></a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar" aria-controls="navbar" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse justify-content-end" id="navbar">
                <ul class="navbar-nav gap-1 text-center mb-lg-0 align-items-md-end">
                    ${loggedInUser && loggedInUser.role === 'admin' ? html`
                        <li class="nav-item dropdown">
                        <a class="nav-link link-primary dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-shield-lock"></i> Админ</a>
                        <ul class="dropdown-menu dropdown-menu-md-end">
                            <li><a class="dropdown-item link-primary" href="/admin/statistics"><i class="bi bi-pie-chart"></i> Статистики</a></li>
                            <li><a class="dropdown-item link-primary" href="/admin/users"><i class="bi bi-people"></i> Потребители</a></li>
                            <li><a class="dropdown-item link-primary" href="/admin/companies"><i class="bi bi-building"></i> Обекти</a></li>
                            <li><a class="dropdown-item link-primary" href="/admin/settings"><i class="bi bi-gear"></i> Настройки</a></li>
                        </ul>
                        </li>
                    ` : ''}
                    <li class="nav-item">
                        <a class="nav-link" href="/products/create"><i class="bi bi-plus"></i> Създай продукт</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/products"><i class="bi bi-box-seam"></i> Стоки</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/orders/create"><i class="bi bi-plus"></i> Създай продажба</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/orders"><i class="bi bi-cart"></i> Продажби</a>
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
                                <li><a class="dropdown-item" href="/references/orders"><i class="bi bi-file-earmark-text"></i> Справка по продажби</a></li>
                                <li><a class="dropdown-item" href="/references/stocks"><i class="bi bi-file-earmark-text"></i> Справка по наличности</a></li>
                                <li><a class="dropdown-item" href="/references/accounting"><i class="bi bi-file-earmark-text"></i> Експорт към счетоводство</a></li>
                            </ul>
                        </li>
                    ` : ''}
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Други
                        </a>
                        <ul class="dropdown-menu dropdown-menu-md-end">
                            <li><button class="dropdown-item" @click=${toggleDarkMode}><i class="bi bi-moon"></i> Тъмен режим</button></li>
                            <li><a class="dropdown-item" href="/categories"><i class="bi bi-tags"></i> Категории</a></li>
                            ${loggedInUser && ['manager', 'admin'].includes(loggedInUser.role) ? html`
                                <li><button class="dropdown-item download-urls" @click=${(e) => downloadProductsURLS({ woo: true })}><i class="bi bi-download"></i> Линкове за продукти (линк към онлайн магазин)</button></li>
                                <li><button class="dropdown-item download-urls" @click=${downloadProductsURLS}><i class="bi bi-download"></i> Линкове за продукти (снимка и описание)</button></li>
                                <li><button class="dropdown-item download-urls" @click=${(e) => downloadProductsURLS({ hidden: true })}><i class="bi bi-download"></i> Линкове за скрити продукти</button></li>
                            ` : ''}
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