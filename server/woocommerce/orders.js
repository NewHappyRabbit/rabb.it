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

const testData = {
    "id": 57744,
    "parent_id": 0,
    "status": "processing",
    "currency": "BGN",
    "version": "9.4.1",
    "prices_include_tax": true,
    "date_created": "2024-11-19T16:05:04",
    "date_modified": "2024-11-19T16:05:05",
    "discount_total": "0.00",
    "discount_tax": "0.00",
    "shipping_total": "0.00",
    "shipping_tax": "0.00",
    "cart_tax": "0.00",
    "total": "2.50",
    "total_tax": "0.00",
    "customer_id": 0,
    "order_key": "wc_order_losxtFi6Q9MFn",
    "billing": {
        "first_name": "Станислава",
        "last_name": "Димитрова",
        "company": "СУПЕР СТИЛ СДНД ЕООД",
        "address_1": "Офис:ВАРНА - АСПАРУХОВО 2 [ул. СРЕДЕЦ No 4 ПАРТЕР]",
        "address_2": "",
        "city": "гр. ВАРНА [п.к.: 9000 област: ВАРНА ]",
        "state": "",
        "postcode": "9000",
        "country": "BG",
        "email": "stanislava_81_1981@abv.bg",
        "phone": "+359876434777"
    },
    "shipping": {
        "first_name": "Станислава",
        "last_name": "Димитрова",
        "company": "СУПЕР СТИЛ СДНД ЕООД",
        "address_1": "Офис:ВАРНА - АСПАРУХОВО 2 [ул. СРЕДЕЦ No 4 ПАРТЕР]",
        "address_2": "",
        "city": "гр. ВАРНА [п.к.: 9000 област: ВАРНА ]",
        "state": "",
        "postcode": "9000",
        "country": "BG",
        "phone": ""
    },
    "payment_method": "cod",
    "payment_method_title": "Наложен платеж",
    "transaction_id": "",
    "customer_ip_address": "212.5.158.74",
    "customer_user_agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    "created_via": "checkout",
    "customer_note": "Спиди Варна Аспарухово ул.Средец 4 партер",
    "date_completed": null,
    "date_paid": null,
    "cart_hash": "326512c3839abe7aa9f4d10d7021e95b",
    "number": "57744",
    "meta_data": [
        {
            "id": 1124061,
            "key": "_relevanssi_noindex_reason",
            "value": "WooCommerce All-in-One SEO"
        },
        {
            "id": 1124098,
            "key": "is_vat_exempt",
            "value": "no"
        },
        {
            "id": 1124099,
            "key": "Econt_Door_Town",
            "value": ""
        },
        {
            "id": 1124100,
            "key": "Econt_Door_Postcode",
            "value": ""
        },
        {
            "id": 1124101,
            "key": "Econt_Door_Street",
            "value": ""
        },
        {
            "id": 1124102,
            "key": "Econt_Door_Street_Intl",
            "value": ""
        },
        {
            "id": 1124103,
            "key": "Econt_Door_Quarter",
            "value": ""
        },
        {
            "id": 1124104,
            "key": "Econt_Door_Quarter_Intl",
            "value": ""
        },
        {
            "id": 1124105,
            "key": "Econt_Door_street_num",
            "value": ""
        },
        {
            "id": 1124106,
            "key": "Econt_Door_building_num",
            "value": ""
        },
        {
            "id": 1124107,
            "key": "Econt_Door_Entrance_num",
            "value": ""
        },
        {
            "id": 1124108,
            "key": "Econt_Door_Floor_num",
            "value": ""
        },
        {
            "id": 1124109,
            "key": "Econt_Door_Apartment_num",
            "value": ""
        },
        {
            "id": 1124110,
            "key": "Econt_Door_Other",
            "value": ""
        },
        {
            "id": 1124111,
            "key": "Econt_City_Courier",
            "value": ""
        },
        {
            "id": 1124112,
            "key": "Econt_Delivery_Days",
            "value": ""
        },
        {
            "id": 1124113,
            "key": "Econt_Priority_Time_Type",
            "value": ""
        },
        {
            "id": 1124114,
            "key": "Econt_Priority_Time_Hour",
            "value": ""
        },
        {
            "id": 1124115,
            "key": "speedy_country_id",
            "value": "100"
        },
        {
            "id": 1124116,
            "key": "speedy_site_id",
            "value": "10135"
        },
        {
            "id": 1124117,
            "key": "speedy_shipping_to",
            "value": "OFFICE"
        },
        {
            "id": 1124118,
            "key": "speedy_pickup_apt_id",
            "value": ""
        },
        {
            "id": 1124119,
            "key": "speedy_pickup_office_id",
            "value": "268"
        },
        {
            "id": 1124120,
            "key": "speedy_street_id",
            "value": ""
        },
        {
            "id": 1124121,
            "key": "speedy_complex_id",
            "value": ""
        },
        {
            "id": 1124122,
            "key": "speedy_street_no",
            "value": ""
        },
        {
            "id": 1124123,
            "key": "speedy_block_no",
            "value": ""
        },
        {
            "id": 1124124,
            "key": "speedy_entrance_no",
            "value": ""
        },
        {
            "id": 1124125,
            "key": "speedy_floor_no",
            "value": ""
        },
        {
            "id": 1124126,
            "key": "speedy_address_note",
            "value": ""
        },
        {
            "id": 1124127,
            "key": "speedy_address_line1",
            "value": ""
        },
        {
            "id": 1124128,
            "key": "speedy_address_line2",
            "value": ""
        },
        {
            "id": 1124129,
            "key": "speedy_apartment_no",
            "value": ""
        },
        {
            "id": 1124130,
            "key": "speedy_destination_services_id",
            "value": "505;STANDARD 24 HOURS;13.76;13.76;BGN"
        },
        {
            "id": 1124131,
            "key": "speedy_country_name",
            "value": "България"
        },
        {
            "id": 1124132,
            "key": "speedy_site_name",
            "value": "гр. ВАРНА [п.к.: 9000 област: ВАРНА ]"
        },
        {
            "id": 1124133,
            "key": "speedy_post_code",
            "value": "9000"
        },
        {
            "id": 1124134,
            "key": "speedy_street_name",
            "value": ""
        },
        {
            "id": 1124135,
            "key": "speedy_complex_name",
            "value": ""
        },
        {
            "id": 1124136,
            "key": "speedy_pickup_office_name",
            "value": "ВАРНА - АСПАРУХОВО 2 [ул. СРЕДЕЦ No 4 ПАРТЕР]"
        },
        {
            "id": 1124137,
            "key": "speedy_pickup_apt_name",
            "value": ""
        },
        {
            "id": 1124138,
            "key": "speedy_destination_services_name",
            "value": "STANDARD 24 HOURS"
        },
        {
            "id": 1124139,
            "key": "speedy_total_price",
            "value": "13.76"
        },
        {
            "id": 1124140,
            "key": "speedy_recipient_price",
            "value": "13.76"
        },
        {
            "id": 1124141,
            "key": "_wc_order_attribution_source_type",
            "value": "typein"
        },
        {
            "id": 1124142,
            "key": "_wc_order_attribution_referrer",
            "value": "https://emo-sklad.bg/page/6/?s=Вата&post_type=product"
        },
        {
            "id": 1124143,
            "key": "_wc_order_attribution_utm_source",
            "value": "(direct)"
        },
        {
            "id": 1124144,
            "key": "_wc_order_attribution_session_entry",
            "value": "https://emo-sklad.bg/cart/"
        },
        {
            "id": 1124145,
            "key": "_wc_order_attribution_session_start_time",
            "value": "2024-11-19 12:48:26"
        },
        {
            "id": 1124146,
            "key": "_wc_order_attribution_session_pages",
            "value": "28"
        },
        {
            "id": 1124147,
            "key": "_wc_order_attribution_session_count",
            "value": "1"
        },
        {
            "id": 1124148,
            "key": "_wc_order_attribution_user_agent",
            "value": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
        },
        {
            "id": 1124149,
            "key": "_wc_order_attribution_device_type",
            "value": "Mobile"
        }
    ],
    "line_items": [
        {
            "id": 7362,
            "name": "Дълги клинове рипс вата",
            "product_id": 54840,
            "variation_id": 0,
            "quantity": 1,
            "tax_class": "",
            "subtotal": "2.50",
            "subtotal_tax": "0.00",
            "total": "2.50",
            "total_tax": "0.00",
            "taxes": [

            ],
            "meta_data": [
                {
                    "id": 64493,
                    "key": "_reduced_stock",
                    "value": "2",
                    "display_key": "_reduced_stock",
                    "display_value": "2"
                }
            ],
            "sku": "1934",
            "price": 2.50,
            "image": {
                "id": "54839",
                "src": "https://emo-sklad.bg/wp-content/uploads/2024/11/1730720130427.jpeg"
            },
            "parent_name": null
        }
    ],
    "tax_lines": [

    ],
    "shipping_lines": [
        {
            "id": 7368,
            "method_title": "Доставка със Speedy",
            "method_id": "speedy_shipping_method",
            "instance_id": "14",
            "total": "0.00",
            "total_tax": "0.00",
            "taxes": [

            ],
            "meta_data": [

            ]
        }
    ],
    "fee_lines": [

    ],
    "coupon_lines": [

    ],
    "refunds": [

    ],
    "payment_url": "https://emo-sklad.bg/checkout/order-pay/57744/?pay_for_order=true&key=wc_order_losxtFi6Q9MFn",
    "is_editable": false,
    "needs_payment": false,
    "needs_processing": true,
    "date_created_gmt": "2024-11-19T13:05:04",
    "date_modified_gmt": "2024-11-19T13:05:05",
    "date_completed_gmt": null,
    "date_paid_gmt": null,
    "econt": {
        "Econt_Shipping_To": "",
        "Econt_Office_Town": "",
        "Econt_Office_Name": "",
        "Econt_Office": "",
        "Econt_Office_Postcode": "",
        "Econt_Machine_Town": "",
        "Econt_Machine_Name": "",
        "Econt_Machine": "",
        "Econt_Machine_Postcode": "",
        "Econt_Door_Town": "",
        "Econt_Door_Postcode": "",
        "Econt_Door_Street": "",
        "Econt_Door_Quarter": "",
        "Econt_Door_street_num": "",
        "Econt_Door_building_num": "",
        "Econt_Door_Entrance_num": "",
        "Econt_Door_Floor_num": "",
        "Econt_Door_Apartment_num": "",
        "Econt_Door_Other": "",
        "Econt_City_Courier": "",
        "Econt_Delivery_Days": "",
        "Econt_Priority_Time_Type": "",
        "Econt_Priority_Time_Hour": "",
        "Econt_Total_Shipping_Cost": "",
        "Econt_Customer_Shipping_Cost": ""
    },
    "speedy": {
        "speedy_country_id": "100",
        "speedy_site_id": "10135",
        "speedy_shipping_to": "OFFICE",
        "speedy_pickup_apt_id": "",
        "speedy_pickup_office_id": "268",
        "speedy_street_id": "",
        "speedy_street_no": "",
        "speedy_complex_id": "",
        "speedy_block_no": "",
        "speedy_entrance_no": "",
        "speedy_floor_no": "",
        "speedy_apartment_no": "",
        "speedy_address_note": "",
        "speedy_destination_services_id": "505;STANDARD 24 HOURS;13.76;13.76;BGN",
        "speedy_country_name": "България",
        "speedy_site_name": "гр. ВАРНА [п.к.: 9000 област: ВАРНА ]",
        "speedy_street_name": "",
        "speedy_complex_name": "",
        "speedy_pickup_office_name": "ВАРНА - АСПАРУХОВО 2 [ул. СРЕДЕЦ No 4 ПАРТЕР]",
        "speedy_pickup_apt_name": "",
        "speedy_destination_services_name": "STANDARD 24 HOURS",
        "speedy_total_price": "13.76",
        "speedy_recipient_price": "13.76"
    },
    "currency_symbol": "лв.",
    "_links": {
        "self": [
            {
                "href": "https://emo-sklad.bg/wp-json/wc/v3/orders/57744",
                "targetHints": {
                    "allow": [
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE"
                    ]
                }
            }
        ],
        "collection": [
            {
                "href": "https://emo-sklad.bg/wp-json/wc/v3/orders"
            }
        ]
    }
};
console.log(await WooHookCreateOrder(testData));
export async function WooHookCreateOrder(data) {
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
    if (wooData.customer?.email)
        customer = await Customer.findOne({ email: wooData.customer.email });
    else if (wooData.customer?.vat?.length > 0 && wooData.customer.vat.match(/^\d{9,10}$/gm))
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