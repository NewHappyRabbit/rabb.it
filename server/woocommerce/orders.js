import { WooCommerce } from "../config/woocommerce.js";
import { OrderController } from "../controllers/orders.js";
import { SettingsController } from "../controllers/settings.js";
import { Customer } from "../models/customer.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { Company } from "../models/company.js";
import { CustomerController } from "../controllers/customers.js";
// On start, check if import all orders from WOO to MONGO (non existing only)

// Test user in woo:
// user: test
// pass: %d54x#)BJ@T01DXh(zegbhhJ

// DONE
// Normal order with customer address: #51553
// Normal order with customer address + 1 product on sale and 1 normal product: #51561
// Order with Econt office: #51543
// Order with Econt customer address: #51542
// Order with Speedy оffice: #51545
// Order with Speedy customer address: #51544
// Normal order with customer address + 1 product + 10% discount coupon used: #51562
// Normal order with customer address + 1 product on sale + 10% discount coupon used: #51563

export async function WooCreateOrder(data) {
    if (!WooCommerce) return;
    // This functions creates a new order in the app from a WooCommerce order. It's activated by a hook in Woocommerce


    return console.log(data);

    const response = await WooCommerce.get('orders/51563');
    const data = response.data;

    // Get default data
    const defaultData = await SettingsController.get({
        keys: ['wooDocumentType'],
    });

    const wooData = {
        number: data.number,
        date: data.date_created,
        orderType: 'wholesale', //TODO change when retail website is created
        type: defaultData.find(setting => setting.key === 'wooDocumentType').value,
        woocommerce: {
            id: data.id,
            status: data.status,
            total: Number(data.total),
            payment_method: data.payment_method,
            payment_method_title: data.payment_method_title,
        },
        customer: {
            name: "ПРОМЕНИ ИМЕТО НА КЛИЕНТА",
            email: data.billing.email,
            phone: data.billing.phone,
            mol: data.billing.first_name + ' ' + data.billing.last_name,
            vat: data.billing.company.replace(/\D+/g, ''),
            address: "ПРОМЕНИ АДРЕСА",
            taxvat: data.billing.company,
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
        wooData.woocommerce.shipping = data.shipping_lines[0].method_title;

    if (data.coupon_lines.length > 0)
        wooData.coupons = data.coupon_lines;

    // Products
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

        wooData.products.push({
            id: product.product_id,
            product: productInDb._id,
            unitOfMeasure: productInDb.unitOfMeasure,
            quantity: Number(product.quantity),
            price: Number(price),
            discount,
        })
    }

    // Check if existing customer
    var customer = await Customer.findOne({ vat: wooData.customer.vat });

    if (customer && !customer.woocommerce) { // Add woo id to existing customer
        customer.woocommerce.id = wooData.customer.id;
        await customer.save();
    } else if (!customer) {  // Create new customer
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

    wooData.paymentType = wooData.woocommerce.payment_method === 'cod' ? 'cash' : 'card'; // TODO Test order with card payment and edit

    const user = await User.findOne({ username: "woocommerce" });

    const { status, message, order, updatedProducts } = await OrderController.post({ data: wooData, userId: user._id });

    return { status, message, order, updatedProducts }
}