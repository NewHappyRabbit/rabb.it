import page from 'page';
import '@/css/products.css';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import { nav } from '@/views/nav.js';
import { until } from 'lit/directives/until.js';
import axios from 'axios';
import { spinner } from '@/views/components';
import { loggedInUser } from '@/views/login';

async function loadProducts() {
    try {
        const req = await axios.get('/products', { params: { page: 'temp' } });
        const { products } = req.data

        return table({ products });
    } catch (err) {
        console.error(err);
        alert('Грешка при зареждане на продуктите');
        return;
    }
}

async function save() {
    const data = [];
    for (let tr of document.querySelectorAll('tbody .attributesEL')) {
        const _id = tr.getAttribute('id');
        let season = Array.from(tr.querySelector('#season').selectedOptions).map(({ value }) => value).filter(e => e !== '');
        let in_category = tr.querySelector('#in_category').value;
        let sex = Array.from(tr.querySelector('#sex').selectedOptions).map(({ value }) => value).filter(e => e !== '');
        data.push({
            _id, attributes: {
                ...(season.length > 0 ? { season } : {}),
                ...(sex.length > 0 ? { sex } : {}),
                ...(in_category !== '' ? { in_category } : {}),
            }
        });
    }

    try {
        const res = await axios.post('/productstempsave', data);
        if (res.status === 200) {
            page('/products/temp');
        } else alert('Грешка при запазване на данните');
    } catch (err) {
        console.error(err);
        alert('Грешка при запазване на данните');
    }
}

const table = ({ products }) => html`
    <div class="table-responsive mt-2">
        <table class="table table-striped table-hover text-center">
                <thead>
                    <tr>
                        <th scope="col">Снимка</th>
                        <th scope="col">Код</th>
                        <th scope="col">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => html`
                        <tr>
                            <td>${product.code}</td>
                            <td>${product?.image?.url ? html`<img class="img-thumbnail" src=${product.image.url}/>` : ''}</td>
                            <td class="text-nowrap">
                                ${attributesTemplate(product)}
                            </td>
                        </tr>
                    `)}
                </tbody >
            </table >
    </div>
    <button type="button" class="btn btn-primary" @click=${save}>Запази</button>
`;

function onSelectAttrCategory(e) {
    const category = e.target.value;

    document.querySelectorAll('#sex option').forEach(opt => opt.selected = false);
    if (category === 'Мъжки')
        document.querySelector('#sex [value="За него"]').selected = true;
    else if (category === 'Дамски')
        document.querySelector('#sex [value="За нея"]').selected = true;
    else if (category === 'Детски')
        document.querySelectorAll('#sex option').forEach(opt => opt.selected = true);
}

const attributesTemplate = (product) => html`
    <div class="d-flex justify-content-around attributesEL" id="${product._id}">
        <div>
        <label for="season">Сезон:</label>
        <select id="season" name="season" class="form-control" multiple>
            <option ?selected=${!product?.attributes?.find(a => a.attribute.slug === 'season')} value="">Избери</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'season' && a.value === 'Пролет/Лято' || a.value.includes('Пролет/Лято'))} value='Пролет/Лято'>Пролет/Лято</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'season' && a.value === 'Есен/Зима' || a.value.includes('Есен/Зима'))} value='Есен/Зима'>Есен/Зима</option>
        </select>
    </div>

    <div>
        <label for="in_category">Категория:</label>
        <select @change=${onSelectAttrCategory} id="in_category" name="in_category" class="form-control">
            <option ?selected=${!product?.attributes?.find(a => a.attribute.slug === 'in_category')} value="">Избери</option>
            ${console.log(product?.attributes)}
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value === 'Детски')} value='Детски'>Детски</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value === 'Мъжки')} value='Мъжки'>Мъжки</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value === 'Дамски')} value='Дамски'>Дамски</option>
        </select>
    </div>

    <div>
        <label for="sex">Пол:</label>
        <select id="sex" name="sex" class="form-control" multiple>
            <option ?selected=${!product?.attributes?.find(a => a.attribute.slug === 'sex')} value="">Избери</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sex' && a.value === 'За него' || a.value.includes('За него'))} value='За него'>За него</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sex' && a.value === 'За нея' || a.value.includes('За нея'))} value='За нея'>За нея</option>
        </select>
    </div>
    </div>
`;

export function tempPage(ctx, next) {
    if (!loggedInUser) return;
    // FIXME DELETE THIS PAGE AFTER ALL PRODDUCTS ATTRIBUTES CREATED
    const template = () => html`
        ${nav()}
        <div class="container-fluid">
            <form>
                ${until(loadProducts(), spinner)}
            </form>
        </div>
    `;

    render(template(), container);
}