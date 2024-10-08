import '@/css/global.css';
import page from 'page';
import { mainPage } from '@/views/main/main.js';
import { logout, loginPage, loggedInUser } from '@/views/login.js';
import { customersRoutes } from '@/views/customers/routes.js';
import { productsRoutes } from '@/views/products/routes.js';
import { categoriesRoutes } from '@/views/categories/routes.js';
import { usersRoutes } from '@/views/admin/users/routes.js';
import { salesRoutes } from '@/views/orders/routes.js';
import { settingsRoutes } from '@/views/admin/settings/routes.js';
import { companiesRoutes } from '@/views/admin/companies/routes.js';
import { referencesSalesRoutes } from '@/views/references/orders/routes.js';
import { statisticsRoutes } from '@/views/admin/statistics/routes.js';
import { toggleDarkMode, initSocket } from '@/api';
import { printerSetup } from '@/printer';


export const container = document.querySelector('body'); // where to render everything

function auth(ctx, next) {
    if (!loggedInUser)
        return page('/login');
    next();
}

function keybinds(e) {
    if (!loggedInUser || e.ctrlKey === false || e.metaKey === false) return;
    if (e.code === 'Digit2') { // CTRL+2 - new order page
        e.preventDefault();
        page('/orders/create');
    } else if (e.code === 'Digit3') { // CTRL+3 - new product page
        e.preventDefault();
        page('/products/create')
    } else if (e.code === 'Digit4') { // CTRL+4 - new customer page
        e.preventDefault();
        page('/customers/create')
    }
}

document.onkeydown = keybinds;

page('/', mainPage);
page('/login', loginPage);
page('/logout', auth, logout);
page('/worker', auth, mainPage);
productsRoutes(auth);
customersRoutes(auth);
categoriesRoutes(auth);
salesRoutes(auth);
referencesSalesRoutes(auth);
usersRoutes();
settingsRoutes();
companiesRoutes();
statisticsRoutes();
page('*', () => page('/')); // Everything else, redirect to home page

page();

if (!loggedInUser)
    page('/login');

initSocket();
printerSetup();


toggleDarkMode({ appStart: true }); // Set dark mode on app start