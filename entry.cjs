// This file is used by SuperHosting.bg to start up the nodejs server

async function loadApp() {
    const { app } = await import("./server/app.js"); // this is your normal server entry file - (index.js, main.js, app.js etc.)
}
loadApp()