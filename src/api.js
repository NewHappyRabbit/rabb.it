import axios from 'axios';
import { io } from 'socket.io-client';
import { html } from 'lit/html.js';
import { loggedInUser } from '@/views/login';
export let serverURL = 'https://localhost:8443'; // used for requests
export let publicURL = 'https://localhost:8443'; // used for resources like img, etc.

let socketPath = '/socket.io';

if (!["localhost", "127.0.0.1"].includes(location.hostname)) {
    serverURL = `https://${location.hostname}/server`;
    publicURL = `https://${location.hostname}`;
    socketPath = '/server/socket.io';
}

axios.defaults.baseURL = serverURL;
axios.defaults.withCredentials = true;

export var socket;
export function initSocket() {
    if (!loggedInUser || socket && socket.connected) return;

    socket = io(publicURL, {
        withCredentials: true,
        path: socketPath,
        addTrailingSlash: true,
        transports: ['polling'],
    });

    socket.on('connected', (id) => {
        console.log('connected to socket id', id);
    })

    socket.on("connect_error", (err) => {
        // the reason of the error, for example "xhr poll error"
        console.error("Socket error", {
            msg: err.message,
            desc: err.description,
            context: err.context
        })
    });
}

const currency = "лв.";
export const asterisk = html`<i class="bi bi-asterisk text-danger asterisk"></i>`;

export function toggleDarkMode({ appStart = false }) {
    const current = localStorage.getItem('darkMode');

    if (appStart) {
        if (current === 'true') {
            document.querySelector('html').setAttribute('data-bs-theme', 'dark');
        } else {
            document.querySelector('html').setAttribute('data-bs-theme', 'light');
        }
        return;
    }

    if (current === 'true') {
        localStorage.setItem('darkMode', 'false');
        document.querySelector('html').setAttribute('data-bs-theme', 'light');
    } else {
        localStorage.setItem('darkMode', 'true');
        document.querySelector('html').setAttribute('data-bs-theme', 'dark');
    }
}

export function markValidEl(el) {
    el.classList.add('is-valid');
    el.classList.remove('is-invalid');
}

export function markInvalidEl(el) {
    el.classList.add('is-invalid');
    el.classList.remove('is-valid');
    return true;
}

export function markValid(elName) {
    const el = document.getElementById(elName);
    el.classList.add('is-valid');
    el.classList.remove('is-invalid');
}

export function markInvalid(elName) {
    const el = document.getElementById(elName);
    el.classList.add('is-invalid');
    el.classList.remove('is-valid');
    return true;
}

export function formatPrice(price) {
    // Convert to xx xxx.xx лв.
    price = price.toFixed(2);
    price = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    price += ` ${currency}`;
    return price;
}

export function formatPriceNoCurrency(price) {
    // Convert to xx xxx.xx
    price = price.toFixed(2);
    price = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return price;
}

export function numberToBGText(number) {
    // Created by https://georgi.unixsol.org/programs/num2bgmoney.php/view/ in PHP
    function convert(number, stotinki = false) {
        const num0 = {
            0: "нула",
            1: "един",
            2: "две",
            3: "три",
            4: "четири",
            5: "пет",
            6: "шест",
            7: "седем",
            8: "осем",
            9: "девет",
            10: "десет",
            11: "единадесет",
            12: "дванадесет",
        }

        const num100 = {
            1: "сто",
            2: "двеста",
            3: "триста"
        }

        const div10 = (number - number % 10) / 10;
        const mod10 = number % 10;
        const div100 = (number - number % 100) / 100;
        const mod100 = number % 100;
        const div1000 = (number - number % 1000) / 1000;
        const mod1000 = number % 1000;
        const div1000000 = (number - number % 1000000) / 1000000;
        const mod1000000 = number % 1000000;
        const div1000000000 = (number - number % 1000000000) / 1000000000;
        const mod1000000000 = number % 1000000000;

        if (number == 0)
            return num0[0];

        // Till 20
        if (number > 0 && number < 20) {
            if (stotinki && number === 1)
                return "една";
            if (stotinki && number === 2)
                return "две";
            if (number === 2)
                return "два";

            return number in num0 ? num0[number] : num0[mod10] += 'надесет';
        }

        // Till 100
        if (number > 19 && number < 100) {
            let temp = div10 === 2 ? "двадесет" : num0[div10] + "десет";
            if (mod10) temp += " и " + convert(mod10, stotinki);
            return temp;
        }

        // Till 1,000
        if (number > 99 && number < 1000) {
            let temp = div100 in num100 ? num100[div100] : num0[div100] + 'стотин';
            if ((mod100 % 10 === 0 || mod100 < 20) && mod100 !== 0) temp += ' и';
            if (mod100) temp += " " + convert(mod100);

            return temp
        }

        // Till 1,000,000
        if (number > 999 && number < 1000000) {
            /* Damn bulgarian @#$%@#$% два хиляди is wrong :) */
            let temp = div1000 === 1 ? "хиляда" : div1000 === 2 ? "две хиляди" : convert(div1000) + " хиляди";
            num0[2] = "два";

            if ((mod1000 % 10 === 0 || mod1000 < 20) && mod1000 !== 0)
                if (!((mod100 % 10 == 0 || mod100 < 20) && mod100 !== 0)) temp += ' и';

            if ((mod1000 % 10 === 0 || mod1000 < 20) && mod1000 !== 0 && mod1000 < 100) return temp += ' и';

            if (mod1000) temp += " " + convert(mod1000);

            return temp;
        }

        /* Over a million */
        if (number > 999999 && number < 1000000000) {
            let temp = (div1000000 == 1) ? "един милион" : convert(div1000000) + " милиона";
            if ((mod1000000 % 10 == 0 || mod1000000 < 20) && mod1000000 != 0)
                if (!((mod1000 % 10 == 0 || mod1000 < 20) && mod1000 != 0))
                    if (!((mod100 % 10 == 0 || mod100 < 20) && mod100 != 0))
                        temp += " и";

            if ((mod1000000 % 10 == 0 || mod1000000 < 20) && mod1000000 != 0 && mod1000000 < 1000)
                if ((mod1000 % 10 == 0 || mod1000 < 20) && mod1000 != 0 && mod1000 < 100)
                    temp += " и";

            if (mod1000000)
                temp += " " + convert(mod1000000);
            return temp;
        }

        /* Over a billion */
        if (number > 99999999 && number <= 2000000000) {
            let temp = (div1000000000 == 1) ? "един милиард" : "";
            temp = (div1000000000 == 2) ? "два милиарда" : temp;
            if (mod1000000000)
                temp += " " + convert(mod1000000000);

            return temp;
        }
        /* Bye ... */
        return "";
    }

    let [lv, st] = number.toFixed(2).toString().split(".");
    lv = Number(lv);

    if (lv >= 2000000000)
        return; // Too big number

    let text = convert(lv);
    text += lv === 1 ? " лев" : " лева";

    if (st && st !== 0) {
        let sttext = convert(st, true);
        text += " и " + sttext;
        text += st === 1 ? " стотинка" : " стотинки";
    }

    return text;
}

export function getVat(price, vat) {
    if (vat === undefined)
        vat = 20;
    // Extract vat from price (price already includes vat)
    return (price * vat) / 100;
}

export function deductVat(price, vat) {
    if (vat === undefined)
        vat = 20;
    // Return the original price with deducted vat
    return price - ((price * vat) / 100);
}

export function roundPrice(price) {
    // Round to 1 decimal
    return Math.round(price * 10) / 10;
}

export function delay(fn, ms) {
    // This function is used for calculating the time between key presses in the search bar
    // So we can fire the search only after the user has stopped typing for a certain amount of time
    let timer = 0
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(fn.bind(this, ...args), ms || 0)
    }
}

export function addQuery(ctx, name, value) {
    var uri = ctx.path;

    if (!name || value === undefined)
        return uri;

    if (!ctx.querystring)
        return uri += `?${name}=${value}`;

    if (ctx.querystring && !ctx.querystring.includes(name))
        return uri += `&${name}=${value}`;

    const regex = new RegExp(`${name}=[^&]*`);

    return uri = uri.replace(regex, `${name}=${value}`);
}

export function removeQuery(ctx, name) {
    var uri = ctx.path;

    const removeRegex = new RegExp(`(\\?)?(&)?${name}=[^&]*`);
    uri = uri.replace(removeRegex, '');

    // Check if url is bugged (../url&name=value) and convert to (../url?name=value)
    const bugfixRegex = /\/.+(&).+=/;
    if (bugfixRegex.test(uri))
        uri = uri.replace(/&/, '?');

    return uri;
}

// replace cyrillic characters with latin
const alphabet = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sht", "ъ": "u", "ь": "y", "ю": "yu", "я": "ya" };

export function transliterate(word) {
    return word.split('').map(function (char) {
        return alphabet[char] || char;
    }).join("");
}

export function slugify(word) {
    return transliterate(word.toLowerCase().replace(/ /g, '-'))
}

export function reverseTranslitarate(word) {
    return word.split('').map(function (char) {
        return Object.keys(alphabet).find(key => alphabet[key] === char) || char;
    }).join("");
}

export function unslugify(word) {
    var newWord = reverseTranslitarate(word.toLowerCase().replace(/-/g, ' '));
    return newWord.charAt(0).toUpperCase() + newWord.slice(1);
}

export function successScan(target) {
    //TODO Uncomment
    const beep = new Audio('/audio/beep.mp3');
    beep.play();

    target.classList.add('flashingSuccessBorder')
    setTimeout(() => target.classList.remove('flashingSuccessBorder'), 1000);
}

export function loadPreviewImage(e) {
    const image = e.target.files[0];
    const imagePreview = document.getElementById('imagePreview');
    const reader = new FileReader();

    reader.onload = function (e) {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('d-none');
    }

    reader.readAsDataURL(image);
}