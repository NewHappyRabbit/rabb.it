import { generateDescription } from '../controllers/products.js';
import { Product } from '../models/product.js';
import { Order } from '../models/order.js';
export async function convertBGNtoEUR() {
    // This function will be used to convert all products prices to EUR on 01.02.2026

    // Run this function only once in app.js
    // Safe-guards in place in case of multiple runs


    // 1. Update the generateDescription function in controllers/products.js to use EURO sign instead of лв.

    // 2. Run this function

    function toEuro(value) {
        const euro = 1.95583;
        return (value / euro).toFixed(2);
    }



    const products = await Product.find({ euroConversionDone: false });
    console.log(`Converting ${products.length} products from BGN to EUR...`);

    for (let product of products) {
        product.deliveryPrice = toEuro(product.deliveryPrice);
        product.wholesalePrice = toEuro(product.wholesalePrice);
        product.retailPrice = toEuro(product.retailPrice);
        product.upsaleAmount = toEuro(product.upsaleAmount);

        //update description
        if (product.description) {
            product.description = generateDescription(product, true);
        }
        product.euroConversionDone = true;
    }

    await Promise.all(products.map(p => p.save()));
    console.log(`Converted ${products.length} products from BGN to EUR.`);


    const orders = await Order.find({ euroConversionDone: false, deleted: false });

    console.log(`Converting ${orders.length} orders from BGN to EUR...`);

    for (let order of orders) {
        order.total = toEuro(order.total);
        order.paidAmount = toEuro(order.paidAmount);

        for (let item of order.paidHistory) {
            item.amount = toEuro(item.amount);
        }

        for (let product of order.products) {
            product.price = toEuro(product.price);
        }
    }

    await Promise.all(orders.map(o => o.save()));
    console.log(`Converted ${orders.length} orders from BGN to EUR.`);

}