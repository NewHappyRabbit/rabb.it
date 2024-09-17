import page from 'page';
import { container } from "@/app.js";
import { html, render } from 'lit/html.js';
import axios from "axios";
import { printerSetup } from '@/printer';
import { initSocket, socket } from '@/api';
import { submitBtn, toggleSubmitBtn } from '@/views/components'

export var loggedInUser = document.cookie.includes('user=') ? JSON.parse(document.cookie.split('; ').find(row => row.startsWith('user=')).split('=')[1]) : null


export function adminAuth(ctx, next) {
    if (!loggedInUser || loggedInUser.role != 'admin')
        return page('/');

    next();
}

export async function logout() {
    await axios.get('/logout').then(() => {
        document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        loggedInUser = null;
        socket.disconnect();
        // full page refresh
        window.location.replace(location.origin);
    }).catch(err => {
        console.error(err);
    });
}

async function login(e) {
    e.preventDefault();
    toggleSubmitBtn();

    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    const alertEl = document.getElementById('alert');

    await axios.post('/login', {
        username,
        password
    }).then(res => {
        // Create cookie with user data
        const { user, maxAge } = res.data;
        const date = new Date();
        date.setTime(date.getTime() + maxAge * 1000);
        const cookie = `user=${JSON.stringify(user)};expires=${date.toUTCString()};path=/`
        document.cookie = cookie;
        loggedInUser = user;

        toggleSubmitBtn();
        alertEl.classList.add('d-none');
        alertEl.textContent = '';
        page('/');

        // initialize socket.io
        initSocket();
        // initialize printer
        printerSetup();
    }).catch(err => {
        toggleSubmitBtn();
        console.error(err);
        alertEl.classList.remove('d-none');
        if (err.response?.data)
            alertEl.textContent = err.response.data;
        else alertEl.textContent = 'Няма връзка със сървъра. Моля опитайте отново.'
    });
}

export function loginPage() {
    // If user is already logged in, redirect to home page
    if (loggedInUser)
        return page('/');

    const loginForm = html`
    <div class="container position-absolute top-50 start-50 translate-middle" style="max-width: 600px">
        <img src="images/logo.png" alt="logo" class="logo d-block m-auto mb-3 w-25">
        <img src="images/logo.png" alt="logo" class="logo d-block m-auto mb-3 w-25">
        <form @submit=${login} class="d-flex flex-column gap-3 m-auto">
            <div>
                <label for="username" class="form-label">Име</label>
                <input class="form-control" type="text" id="username" name="username" required autocomplete="off" autocapitalize="off">
            </div>
            <div>
                <label for="password" class="form-label">Парола</label>
                <input class="form-control" type="password" id="password" name="password" minlength="6" required autocomplete="off">
            </div>
            ${submitBtn({ text: "Вход", classes: "w-50 m-auto" })}
        </form>
        <div id="alert" class="alert alert-danger mt-3 d-none"></div>
    </div>
    `;

    render(loginForm, container);
}