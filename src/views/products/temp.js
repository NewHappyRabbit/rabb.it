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
        let sizes_groups = tr.querySelector('#sizes_groups').value;
        let sex = Array.from(tr.querySelector('#sex').selectedOptions).map(({ value }) => value).filter(e => e !== '');
        data.push({
            _id, attributes: {
                ...(season.length > 0 ? { season } : {}),
                ...(sex.length > 0 ? { sex } : {}),
                ...(in_category !== '' ? { in_category } : {}),
                ...(sizes_groups !== '' ? { sizes_groups } : {})
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
                            <td>${product?.image?.url ? html`<img loading="lazy" class="img-thumbnail" src=${product.image.url}/>` : ''}</td>
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

function onSelectAttrCategory(e, _id) {
    const category = e.target.value;

    document.querySelectorAll(`#sex.id-${_id} option`).forEach(opt => opt.selected = false);
    if (category === 'Мъжки')
        document.querySelector(`#sex.id-${_id} [value="За него"]`).selected = true;
    else if (category === 'Дамски')
        document.querySelector(`#sex.id-${_id} [value = "За нея"]`).selected = true;
    else if (category === 'Детски')
        document.querySelectorAll(`#sex.id-${_id} option`).forEach(opt => opt.selected = true);
}

const attributesTemplate = (product) => html`
    <div class="d-flex justify-content-around attributesEL" id="${product._id}">
        <div>
        <label for="season">Сезон:</label>
        <select id="season" name="season" class="form-control" multiple>
            <option ?selected=${!product?.attributes?.find(a => a.attribute.slug === 'season')} value="">Избери</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'season' && a.value.includes('Пролет/Лято'))} value='Пролет/Лято'>Пролет/Лято</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'season' && a.value.includes('Есен/Зима'))} value='Есен/Зима'>Есен/Зима</option>
        </select>
    </div>

    <div>
        <label for="in_category">Категория:</label>
        <select @change=${(e) => onSelectAttrCategory(e, product._id)} id="in_category" name="in_category" class="form-control">
            <option ?selected=${!product?.attributes?.find(a => a.attribute.slug === 'in_category')} value="">Избери</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value.includes('Детски'))} value='Детски'>Детски</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value.includes('Мъжки'))} value='Мъжки'>Мъжки</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'in_category' && a.value.includes('Дамски'))} value='Дамски'>Дамски</option>
        </select>
    </div>

    <div>
        <label for="sizes_groups">Размери:</label>
        <select id="sizes_groups" name="sizes_groups" class="form-control" multiple>
            <option ?selected=${!product?.attributes?.find(a => a.attribute.slug === 'sizes_groups')} value="">Избери</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Бебешки (0-24 м.)'))} value='Бебешки (0-24 м.)'>Бебешки (0-24 м.)</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Детски (2-10 г.)'))} value='Детски (2-10 г.)'>Детски (2-10 г.)</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Юношески (10-18 г.)'))} value='Юношески (10-18 г.)'>Юношески (10-18 г.)</option>
                <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sizes_groups' && a.value.includes('Възрастни (S,M,L,XL,...)'))} value='Възрастни (S,M,L,XL,...)'>Възрастни (S,M,L,XL,...)</option>
        </select>
    </div>

    <div>
        <label for="sex">Пол:</label>
        <select id="sex" name="sex" class="form-control id-${product._id}" multiple>
            <option ?selected=${!product?.attributes?.find(a => a.attribute.slug === 'sex')} value="">Избери</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sex' && a.value.includes('За него'))} value='За него'>За него</option>
            <option ?selected=${product?.attributes?.find(a => a.attribute.slug === 'sex' && a.value.includes('За нея'))} value='За нея'>За нея</option>
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