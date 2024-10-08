import { nav } from "@/views/nav.js";
import { container } from "@/app.js";
import { formatPrice } from "@/api.js";
import { until } from "lit/directives/until.js";
import { html, render } from "lit/html.js";
import { spinner } from "@/views/components";
import axios from "axios";

async function loadStatistics() {
    const res = await axios.get('/statistics');
    const data = res.data;

    return html`
        <div class="card">
            <div class="card-header">
                Общо дължими пари от продажби
            </div>
            <div class="card-body">
                <h5 class="card-title">${formatPrice(data.totalUnpaid)}</h5>
            </div>
        </div>
    `
}

const template = () => html`
    <div class="container-fluid"></div>
        ${nav()}
        <div class="container-fluid mt-2">
            ${until(loadStatistics(), spinner)}
        </div>
    </div>
`;

export function statisticsPage(ctx, next) {
    render(template(), container);
}