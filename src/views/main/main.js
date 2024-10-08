import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { nav } from "@/views/nav.js";
import { loggedInUser } from "@/views/login";

export function mainPage() {
    const template = () => html`
        ${nav()}
        <div id="mainDiv" class="d-flex gap-3 mb-3 p-3 align-items-center flex-wrap">
            <a href="/products" class="btn btn-warning fs-2"><i class="bi bi-box-seam"></i> Стоки</a>
            <a href="/orders" class="btn btn-warning fs-2"><i class="bi bi-cart"></i> Продажби</a>
            <a href="/customers" class="btn btn-warning fs-2"><i class="bi bi-people"></i> Партньори</a>
            <a href="/categories" class="btn btn-warning fs-2"><i class="bi bi-tags"></i> Категории</a>

            <!-- MANAGER AND ADMIN ONLY PAGES -->
            ${loggedInUser && ['manager', 'admin'].includes(loggedInUser.role) ? html`
                <a href="/references/orders" class="btn btn-warning fs-2"><i class="bi bi-file-earmark-text"></i> Справки по продажби</a>
                <a href="/references/accounting" class="btn btn-warning fs-2"><i class="bi bi-file-earmark-text"></i> Справки към счетоводство</a>
            ` : ''}

            <!-- ADMIN ONLY PAGES -->
            ${loggedInUser && loggedInUser.role === 'admin' ? html`
                <a href="/admin/users" class="btn btn-primary fs-2"><i class="bi bi-people"></i> Потребители</a>
                <a href="/admin/companies" class="btn btn-primary fs-2"><i class="bi bi-building"></i> Обекти</a>
                <a href="/admin/settings" class="btn btn-primary fs-2"><i class="bi bi-gear"></i> Настройки</a>
                <a href="/admin/statistics" class="btn btn-primary fs-2"><i class="bi bi-pie-chart"></i> Статистики</a>
            ` : ''}
        </div>
    `;

    render(template(), container);
}