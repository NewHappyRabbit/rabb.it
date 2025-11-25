import { html, render } from 'lit-html';
import { formatPrice, socket, BGNtoEuro } from '@/api';
import { loggedInUser } from '@/views/login';

export var selectedPrinter, availablePrinters = [], printerFound;

export function printerSockets() {
    // check if pc with printer is connected (check happens if no printer found on this device)
    // when a pc with printer connects or disconnects, update status
    socket.on('remotePrinter', (bool) => {
        printerFound = bool; // if true then it connected, if false it disconnected

        const printerIcon = document.getElementById('printerIconNav');
        if (!printerIcon) return; // nav is not yet rendered

        if (printerFound) {
            printerIcon.classList.add('text-success');
            printerIcon.classList.remove('text-danger');
            printerIcon.classList.remove('text-warning');
        } else {
            printerIcon.classList.add('text-danger');
            printerIcon.classList.remove('text-success');
            printerIcon.classList.remove('text-warning');
        }
    })

    // initialize socket.io print commands only on the device that has a printer connected
    socket.on('printRestock', products => {
        for (let product of products)
            printLabel(product, product.quantity);
    });

    socket.on('print', (product, quantity) => {
        printLabel(product, quantity);
    });

    socket.on('printNonDB', product => {
        printLabelNonDB(product);
    });
}

export async function printerSetup() {
    if (!loggedInUser) return;

    //Get the default device from the application as a first step. Discovery takes longer to complete.
    await BrowserPrint.getDefaultDevice("printer", async function (device) {
        //Add device to list of devices
        selectedPrinter = device;
        availablePrinters.push(device);

        //Discover any other devices available to the application
        await BrowserPrint.getLocalDevices(function (device_list) {
            for (var i = 0; i < device_list.length; i++) {
                //Add device to list of devices
                availablePrinters.push(device);

                // set as default if none found
                if (!selectedPrinter) selectedPrinter = device;
            }

            // if local printer found, emit to all other devices
            socket.emit('printerConnected');
        }, function (error) {
            socket.emit('remotePrinter');
        });
    }, function (error) {
        socket.emit('remotePrinter');
    });
    const printerModalDiv = document.getElementById('selectPrinterModalDiv');

    if (!printerModalDiv) return; // not yet rendered
    render(printerModal(), printerModalDiv);
}

export const printerModal = () => html`
    <div class="modal fade" id="selectPrinterModal" tabindex="-1" aria-labelledby="selectPrinterModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
            <div class="modal-header">
                <h1 class="modal-title fs-5" id="selectPrinterModalLabel">Избери принтер за етикети</h1>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <select class="form-select">
                    ${availablePrinters.map(printer => html`<option ?selected=${printer.uid === selectedPrinter?.uid} value="${printer.uid}">${printer.name} [${printer.connection}]</option>`)}
                </select>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отказ</button>
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click=${setSelectedPrinter}>Запази</button>
            </div>
            </div>
        </div>
    </div>
`;

export function setSelectedPrinter() {
    const selectedPrinterUid = document.querySelector('#selectPrinterModal select').value;
    if (!selectedPrinterUid) return;

    const printer = availablePrinters.find(printer => printer.uid === selectedPrinterUid);

    if (!printer) return;

    selectedPrinter = printer;
}

function printLabelNonDB(product) {
    if (!product || !product.name || !product.price || !product.quantity) return console.error('Missing product data for printing label');

    const zplCommand25x55 = `
    ^XA
    ~TA024
    ~JSN
    ^LT0
    ^MNW
    ^MTT
    ^PON
    ^PMN
    ^LH0,0
    ^JMA
    ^PR4,4
    ~SD17
    ^JUS
    ^LRN
    ^CI27
    ^PA0,1,1,0
    ^XZ
    ^XA
    ^MMT
    ^PW440
    ^LL200
    ^LS0
    ^FT0,35^A0N,28,28^FB440,1,7,C^FH\^CI28^FD${product.name}^FS^CI27
    ^FT11,150^A0N,28,28^FH\^CI28^FD${product?.qtyInPackage > 1 ? `${product.qtyInPackage} бр. по` : ''}^FS^CI27
    ^FT11,185^A0N,28,28^FH\^CI28^FD${formatPrice(product?.qtyInPackage > 1 ? (product.price / product.qtyInPackage) : product.price)} / ${formatPrice(BGNtoEuro((product?.qtyInPackage > 1 ? (product.price / product.qtyInPackage) : product.price)), true)}^FS^CI27
    ^PQ${product.quantity},0
    ^XZ
    `;
    /* BIG LABEL
        const zplCommand = `
        ^XA
        ~TA024
        ~JSN
        ^LT0
        ^MNW
        ^MTT
        ^PON
        ^PMN
        ^LH0,0
        ^JMA
        ^PR4,4
        ~SD17
        ^JUS
        ^LRN
        ^CI27
        ^PA0,1,1,0
        ^XZ
        ^XA
        ^MMT
        ^PW464
        ^LL599
        ^LS0
        ^BY3,2,47^FT426,433^BEB,,Y,N
        ^FH\^FD${product.barcode}^FS
        ^FT47,599^A0B,34,33^FB205,1,9,C^FH\^CI28^FDИме: ${product.name}\5C&^FS^CI27
        ^FT101,599^A0B,34,33^FB351,1,9,C^FH\^CI28^FDБрой в пакет:  ${product?.qtyInPackage > 1 ? `${product.qtyInPackage} бр.` : ''}\5C&^FS^CI27
        ^FT157,592^A0B,34,33^FH\^CI28^FDЦена на пакет: ${formatPrice(product.price)} / ${formatPrice(BGNtoEuro(product.price), true)}^FS^CI27
        ^FT216,592^A0B,34,33^FH\^CI28^FD${product?.qtyInPackage > 1 ? `${formatPrice((product.price / product.qtyInPackage))} / ${formatPrice(BGNtoEuro((product.price / product.qtyInPackage)), true)}` : ''}^FS^CI27
        ^PQ${product.quantity},Y
        ^XZ
        `; */

    sendZPLCommand(zplCommand25x55);
}

export function printLabel(product, quantity = 1) {
    // The below code was generated with these steps:
    // 1. Install ZebraDesigner3
    // 2. Setup the label however you want
    // 3. Go to File > Print > check "Print to file" > click "Print"
    // 4. Save the file and then edit with notepad
    // 5. First line is some thrash, so skip it and copy everything else. Done!

    if (!product.barcode || !product.name || !product.wholesalePrice || !product.code) return console.error('Missing product data for printing label');

    const zplCommand25x55 = `^XA
~TA024
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR4,4
~SD17
^JUS
^LRN
^CI27
^PA0,1,1,0
^XZ
^XA
^MMT
^PW440
^LL200
^LS0
^BY3,2,41^FT66,89^BEN,,N,N
^FH\^FD${product.barcode}^FS
^FT0,35^A0N,28,28^FB440,1,7,C^FH\^CI28^FD${product.name} ${product.sizes?.length > 0 ? `[${product.sizes[0].size}-${product.sizes[product.sizes.length - 1].size}]` : ''}^FS^CI27
^FT11,140^A0N,34,33^FH\^CI28^FD${product?.sizes?.length > 0 ? `${product.sizes.length * product.multiplier} бр. по:` : ''}^FS^CI27
^FT11,183^A0N,34,33^FH\^CI28^FD${formatPrice(product?.sizes?.length > 0 ? (product.wholesalePrice / (product.sizes.length * product.multiplier)) : product.wholesalePrice)} / ${formatPrice(BGNtoEuro(product?.sizes?.length > 0 ? ((product.wholesalePrice / (product.sizes.length * product.multiplier))) : product.wholesalePrice), true)}^FS^CI27
^FT293,186^A0N,28,28^FH\^CI28^FDКод: ${product.code}^FS^CI27
^PQ${quantity},0
^XZ
`;

    const zplCommand = `
    ^XA
    ~TA024
    ~JSN
    ^LT0
    ^MNW
    ^MTT
    ^PON
    ^PMN
    ^LH0,0
    ^JMA
    ^PR4,4
    ~SD17
    ^JUS
    ^LRN
    ^CI27
    ^PA0,1,1,0
    ^XZ
    ^XA
    ^MMT
    ^PW440
    ^LL200
    ^LS0
    ^BY3,2,32^FT78,80^BEN,,N,N
    ^FH\^FD${product.barcode}^FS
    ^FT0,35^A0N,28,28^FB440,1,7,C^FH\^CI28^FD${product.name} ${product.sizes?.length > 0 ? `[${product.sizes[0].size}-${product.sizes[product.sizes.length - 1].size}]` : ''}^FS^CI27
    ^FT6,147^A0N,28,28^FH\^CI28^FD${product?.sizes?.length > 0 ? `${product.sizes.length * product.multiplier} бр. по:` : ''} ${formatPrice(product?.sizes?.length > 0 ? (product.wholesalePrice / (product.sizes.length * product.multiplier)) : product.wholesalePrice)} / ${formatPrice(BGNtoEuro(product?.sizes?.length > 0 ? ((product.wholesalePrice / (product.sizes.length * product.multiplier))) : product.wholesalePrice), true)}^FS^CI27
    ^FT309,186^A0N,28,28^FH\^CI28^FDКод: ${product.code}^FS^CI27
    ^FT6,185^A0N,23,23^FH\^CI28^FDЕд. цена: ${formatPrice(product.retailPrice)} / ${formatPrice(BGNtoEuro(product.retailPrice), true)}^FS^CI27
    ^PQ${quantity},0
    ^XZ`;

    sendZPLCommand(zplCommand);
}

function sendZPLCommand(zplCommand) {
    if (!selectedPrinter) {
        // Try finding printer
        BrowserPrint.getDefaultDevice("printer", function (device) {
            selectedPrinter = device;

            selectedPrinter.send(zplCommand, undefined, (err) => {
                console.error(err);
            });
        }, function (error) {
            return alert('Не успяхме да намерим принтер за етикети!');
        });
    } else {
        selectedPrinter.send(zplCommand, undefined, (err) => {
            console.error(err);
        });
    }
}