import { WooCommerce } from "../config/woocommerce.js";
import { OrderController } from "../controllers/orders.js";
import { SettingsController } from "../controllers/settings.js";
import { Customer } from "../models/customer.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { Company } from "../models/company.js";
import { CustomerController } from "../controllers/customers.js";
import { Order, woocommerce } from "../models/order.js";
import { retry } from "./common.js";
import cron from 'node-cron';
import { WooUpdateQuantityProducts } from "./products.js";

export async function WooHookCreateOrder(data) {
    console.log('Starting woo hook order...')
    if (!WooCommerce) return;
    // This functions creates a new order in the app from a WooCommerce order. It's activated by a hook in Woocommerce

    // Get default data
    const defaultData = await SettingsController.get({
        keys: ['wooDocumentType'],
    });

    const wooData = {
        date: data.date_created,
        orderType: 'wholesale', //TODO change when retail website is created
        type: defaultData.find(setting => setting.key === 'wooDocumentType').value,
        woocommerce: {
            id: data.id,
            status: data.status,
            total: Number(data.total),
            payment_method: data.payment_method || 'cod',
            payment_method_title: data.payment_method_title || 'Наложен платеж',
        },
        customer: {
            name: "ПРОМЕНИ ИМЕТО НА КЛИЕНТА",
            email: data.billing.email,
            phone: data.billing.phone,
            mol: data.billing.first_name + ' ' + data.billing.last_name,
            vat: data.billing.company.replace(/\D+/g, ''),
            address: "ПРОМЕНИ АДРЕСА",
            woocommerce: {
                id: data.customer_id
            },
        },
        discount_total: Number(data.discount_total),
        billing: data.billing,
        // shipping: data.shipping,
        products: []
    };

    if (data.customer_note)
        wooData["customer_note"] = data.customer_note;

    // Speedy shipping
    if (data.meta_data.find(meta => meta.key === 'speedy_shipping_to')?.value && data.meta_data.find(meta => meta.key === 'speedy_shipping_to')?.value !== '') {
        // General info for both address and office pickups
        wooData.woocommerce.speedy = {
            country: data.meta_data.find(meta => meta.key === 'speedy_country_name').value,
            locality: data.meta_data.find(meta => meta.key === 'speedy_site_name').value,
            postal_code: data.meta_data.find(meta => meta.key === 'speedy_post_code').value,
            total: data.meta_data.find(meta => meta.key === 'speedy_total_price').value
        }

        // Office
        if (data.meta_data.find(meta => meta.key === 'speedy_shipping_to').value === 'OFFICE') {
            wooData.woocommerce.speedy.office = data.meta_data.find(meta => meta.key === 'speedy_pickup_office_name').value;

        }
        // Address
        else if (data.meta_data.find(meta => meta.key === 'speedy_shipping_to')?.value === 'ADDRESS') {
            wooData.woocommerce.speedy.street = data.meta_data.find(meta => meta.key === 'speedy_street_name').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_street_no')?.value)
                wooData.woocommerce.speedy.number = data.meta_data.find(meta => meta.key === 'speedy_street_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_entrance_no')?.value)
                wooData.woocommerce.speedy.entrance = data.meta_data.find(meta => meta.key === 'speedy_entrance_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_floor_no')?.value)
                wooData.woocommerce.speedy.floor = data.meta_data.find(meta => meta.key === 'speedy_floor_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_apartment_no')?.value)
                wooData.woocommerce.speedy.apartment = data.meta_data.find(meta => meta.key === 'speedy_apartment_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_address_note')?.value)
                wooData.woocommerce.speedy.note = data.meta_data.find(meta => meta.key === 'speedy_address_note').value;
        }

    }

    // Econt shipping
    if (data.meta_data.find(meta => meta.key === 'Econt_Shipping_To')?.value && data.meta_data.find(meta => meta.key === 'Econt_Shipping_To')?.value !== '') {
        // Office
        if (data.meta_data.find(meta => meta.key === 'Econt_Shipping_To').value === 'OFFICE') {
            wooData.woocommerce.econt = {
                ship_to: 'Офис',
                city: data.meta_data.find(meta => meta.key === 'Econt_Office_Town').value,
                office: data.shipping.address_1,
                postal_code: data.meta_data.find(meta => meta.key === 'Econt_Office_Postcode').value,
                total: data.meta_data.find(meta => meta.key === 'Econt_Total_Shipping_Cost').value
            }
        }

        // Address
        if (data.meta_data.find(meta => meta.key === 'Econt_Shipping_To').value === 'DOOR') {
            wooData.woocommerce.econt = {
                ship_to: 'Адрес',
                city: data.meta_data.find(meta => meta.key === 'Econt_Door_Town').value,
                postal_code: data.meta_data.find(meta => meta.key === 'Econt_Door_Postcode').value,
                street: data.meta_data.find(meta => meta.key === 'Econt_Door_Street').value,
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_street_num').value && { number: data.meta_data.find(meta => meta.key === 'Econt_Door_street_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Entrance_num').value && { entrance: data.meta_data.find(meta => meta.key === 'Econt_Door_Entrance_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Floor_num').value && { floor: data.meta_data.find(meta => meta.key === 'Econt_Door_Floor_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Apartment_num').value && { apartment: data.meta_data.find(meta => meta.key === 'Econt_Door_Apartment_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Other').value && { note: data.meta_data.find(meta => meta.key === 'Econt_Door_Other').value }), // could be a door note or address if it cant be found in the Econt form
                total: Number(data.meta_data.find(meta => meta.key === 'Econt_Total_Shipping_Cost').value)
            }
        }
    }

    //TODO Implement normal shipping (get customer address instead of this. This is used in emo-sklad only, because they dont offer shipping to address, only econt and speedy)
    if (!wooData.woocommerce.speedy && !wooData.woocommerce.econt)
        wooData.woocommerce.shipping = data.shipping_lines[0]?.method_title || 'Бърза поръчка по телефон';

    if (data.coupon_lines.length > 0)
        wooData.coupons = data.coupon_lines;
    // Products
    let index = 0;
    for (let product of data.line_items) {
        const productInDb = await Product.findOne({ "woocommerce.id": product.product_id.toString() });
        if (!productInDb) return { status: 404, message: 'Продуктът не е намерен' };

        // Check quantity
        if (productInDb.quantity < product.quantity) return { status: 400, message: 'Няма достатъчно количество от продукта: ' + productInDb.name + ' (наличност: ' + productInDb.quantity + ')' + `[${productInDb.code}]` };

        let discount = 0, price = product.price;
        //TODO Edit this when sale price is implemented to check sale price as well
        // Check if price from woo is different from price in db (either product is on sale or coupon was applied)
        if (productInDb.wholesalePrice !== product.price) {
            // Calculate discount percentage based on difference of prices
            discount = parseFloat(Math.abs(((product.price - productInDb.wholesalePrice) / productInDb.wholesalePrice) * 100).toFixed(2));
            price = productInDb.wholesalePrice;
        }

        const productData = {
            index: index++,
            id: product.product_id,
            product: productInDb._id,
            unitOfMeasure: productInDb.unitOfMeasure,
            quantity: Number(product.quantity),
            price: Number(price),
            discount,
        }

        if (productInDb.sizes.length)
            productData.selectedSizes = productInDb.sizes.map(s => s.size)

        if (productInDb.multiplier)
            productData.multiplier = productInDb.multiplier;

        wooData.products.push(productData);
    }
    // Check if customer already in db
    //FIXME For some reason, wooData returns customer.id as 0 instead of the actual ID. Investigate...
    // var customer = await Customer.findOne({"woocommerce.id": })
    //TEMPFIX
    var customer;

    // First try to find by email
    if (wooData.customer?.email)
        customer = await Customer.findOne({ email: wooData.customer.email });

    // Then if not found, try to find by vat
    if (wooData.customer?.vat?.length > 0 && wooData.customer.vat.match(/^\d{9,10}$/gm))
        customer = await Customer.findOne({ vat: wooData.customer.vat })
    else customer = null

    if (customer && !customer.woocommerce) { // Add woo id to existing customer
        customer.woocommerce.id = wooData.customer.id;
        await customer.save();
    } else if (!customer) {  // Create new customer
        // Check if customer entered VAT number or company name
        if (wooData.customer.vat?.length > 0 && !wooData.customer.vat.match(/^\d{9,10}$/gm)) {
            wooData.customer.vat = '';
            wooData.customer.taxvat = '';
        }
        const { status, message, customer: customerInDb } = await CustomerController.post(wooData.customer);
        customer = customerInDb;
        if (status !== 201) return { status, message };
    }

    wooData.customer = customer._id;
    wooData.receiver = customer.receivers.pop();

    // Get default company
    const defaultCompany = await Company.findOne({ default: true });

    if (!defaultCompany)
        return { status: 400, message: 'Не е намерена компания по подразбиране' };

    wooData.company = defaultCompany._id;
    wooData.sender = defaultCompany.senders.pop();

    wooData.paymentType = wooData.woocommerce.payment_method === 'cod' ? 'cash' : 'card'; // TODO Test order with card payment

    const user = await User.findOne({ username: "woocommerce" });

    const { status, message, order, updatedProducts } = await OrderController.post({ data: wooData, userId: user._id });

    return { status, message, order, updatedProducts }
}

export async function WooUpdateOrder({ id, updatedProducts }) {
    if (!WooCommerce) return;

    const order = await Order.findById(id).populate('products.product');

    if (!order) return { status: 404, message: 'Продажбата не е намерен' };

    if (!order?.woocommerce?.id) // Order was not made from woo, just update product quantity
        await WooUpdateQuantityProducts(updatedProducts);

    if (!Object.keys(woocommerce.status).includes(order.woocommerce.status)) return { status: 400, message: 'Невалиден статус за поръчка' };

    if (!Object.keys(woocommerce.payment_method).includes(order.woocommerce.payment_method)) return { status: 400, message: 'Невалиден тип на плащане за поръчка' };

    // Get Woo Order
    const req = await WooCommerce.get(`orders/${order.woocommerce.id}`);
    const wooOrder = req.data;

    const wooData = {
        status: order.woocommerce.status,
        line_items: []
    }

    // Remove all previous products from order
    for (let product of wooOrder.line_items) {
        wooData.line_items.push({
            id: product.id,
            quantity: 0,
        })
    }

    // Add products to order
    for (let product of order.products) {
        if (!product.product) continue; // Skip if product doesnt exist in WooCommerce

        // Check if product in Woo
        if (!product.product?.woocommerce?.id || product.product?.deleted === true || product.product?.hidden === true) continue; // Skip if product doesnt exist in WooCommerce, is deleted or is hidden

        wooData.line_items.push({
            product_id: product.product.woocommerce.id,
            quantity: product.quantity,
            price: product.product.wholesalePrice,
            subtotal: (product.price * product.quantity).toFixed(2),
            total: ((product.price * product.quantity) * (100 - product.discount) / 100).toFixed(2),
        });
    }

    await retry(async () => {
        await WooCommerce.put(`orders/${order.woocommerce.id}`, wooData);
        console.log('Order successfully edited in WooCommerce!')

        await WooUpdateQuantityProducts(updatedProducts);
    });
}

async function getNewOrders() {
    // This function gets all orders of type "Processing" and checks if they are in the app.
    if (!WooCommerce) return;

    console.log('Look for new orders from WooCommerce...');

    // Get latest woo order id from db
    const latestWooOrder = await Order.findOne({ "woocommerce.id": { $exists: true } }).sort({ _id: -1 });

    // Get date for that order from woocommerce
    const orderReq = await WooCommerce.get(`orders/${latestWooOrder.woocommerce.id}`);
    const order = orderReq.data;

    const orderDate = order.date_created_gmt;

    const ordersReq = await WooCommerce.get('orders', { status: 'processing', after: orderDate, "per_page": 50, "order": "asc" });
    const orders = ordersReq.data;

    if (orders.length === 0 || (orders.length === 1 && orders[0].id == latestWooOrder.woocommerce.id)) return console.log('No new orders from WooCommerce.');

    // Check if orders are already in db
    for (let order of orders) {
        const orderInDb = await Order.findOne({ "woocommerce.id": order.id });
        if (orderInDb) continue;
        else {
            console.log(`Found new order with ID: ${order.id} from WooCommerce. Attempting to create it...`);
            const { status, message } = await WooHookCreateOrder(order);
            if (status !== 201) {
                console.error('Failed to created Woo order with ID: ' + order.id);
                console.error(message);
            } else {
                console.log('Successfully created Woo order with ID: ' + order.id);
            }
        }
    }
}

// Run this every 3 hours
// cron.schedule('0 */3 * * *', async () => {
//     if (!WooCommerce) return;
//     console.log('Running WooCommerce orders CRON...')
//     getNewOrders();
// });