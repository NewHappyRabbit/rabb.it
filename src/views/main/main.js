import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { nav } from "@/views/nav.js";
import { loggedInUser } from "@/views/login";

export function mainPage() {
    const template = () => html`
        ${nav()}
        <div id="mainDiv" class="d-flex gap-3 mb-3 p-3 align-items-center flex-wrap">
            <a href="/products" class="btn btn-warning fs-2"><i class="bi bi-box-seam"></i> Стоки</a>
            <a href="/sales" class="btn btn-warning fs-2"><i class="bi bi-cart"></i> Продажби</a>
            <a href="/customers" class="btn btn-warning fs-2"><i class="bi bi-people"></i> Партньори</a>
            <a href="/categories" class="btn btn-warning fs-2"><i class="bi bi-tags"></i> Категории</a>
            ${loggedInUser && ['manager', 'admin'].includes(loggedInUser.role) ? html`<a href="/references/sales" class="btn btn-warning fs-2"><i class="bi bi-file-earmark-text"></i> Справки</a>` : ''}
            ${loggedInUser && loggedInUser.role === 'admin' ? html`<a href="/admin/users" class="btn btn-primary fs-2"><i class="bi bi-people"></i> Потребители</a>` : ''}
            ${loggedInUser && loggedInUser.role === 'admin' ? html`<a href="/admin/companies" class="btn btn-primary fs-2"><i class="bi bi-building"></i> Обекти</a>` : ''}
            ${loggedInUser && loggedInUser.role === 'admin' ? html`<a href="/admin/settings" class="btn btn-primary fs-2"><i class="bi bi-gear"></i> Настройки</a>` : ''}
        </div>
    `;

    render(template(), container);
}