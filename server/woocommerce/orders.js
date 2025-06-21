import { WooCommerce_Shops } from "../config/woocommerce.js";
import { OrderController } from "../controllers/orders.js";
import { SettingsController } from "../controllers/settings.js";
import { Customer } from "../models/customer.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { Company } from "../models/company.js";
import { CustomerController } from "../controllers/customers.js";
import { Order, woocommerce } from "../models/order.js";
import { WooUpdateQuantityProducts } from "./products.js";

export async function WooHookCreateOrder({ shop, data }) {
    console.log('Starting woo hook order...')
    if (WooCommerce_Shops.length === 0 || !shop || !data) return;
    // This functions creates a new order in the app from a WooCommerce order. It's activated by a hook in Woocommerce

    // Get default data
    const defaultData = await SettingsController.get({
        keys: ['wooDocumentType'],
    });

    const wooData = {
        date: data.date_created,
        orderType: shop.custom.type,
        type: defaultData.find(setting => setting.key === 'wooDocumentType').value,
        woocommerce: {
            woo_url: shop.url,
            id: data.id,
            //FIXME Svilen wants the order to be completed on saving. It doesnt matter what status is sent by woocommerce, we set here as 'completed'. So once the order is saved for the first time in our app, this status will be sent back to woocommerce and mark it as completed. (Because he is too lazy to select the "Completed" status from a dropdown...)
            // status: data.status,
            status: 'completed',
            total: Number(data.total),
            payment_method: data.payment_method || 'cod',
            payment_method_title: data.payment_method_title || 'Наложен платеж',
        },
        customer: {
            name: shop.custom.type === 'wholesale' ? "ПРОМЕНИ ИМЕТО НА КЛИЕНТА" : `${data.billing.first_name} ${data.billing.last_name}`,
            email: data.billing.email,
            phone: data.billing.phone,
            ...(shop.custom.type === 'wholesale' && {
                mol: `${data.billing.first_name} ${data.billing.last_name}`,
                vat: data.billing.company.replace(/\D+/g, ''),
            }),
            address: shop.custom.type === 'wholesale' ? "ПРОМЕНИ АДРЕСА" : `${data.billing.country}, ${data.billing.city} ${data.billing.postcode}, ${data.billing.address_1} ${data.billing.address_2}`,
            woocommerce: {
                woo_url: shop.url,
                id: data.customer_id
            },
        },
        discount_total: Number(data.discount_total),
        billing: data.billing,
        products: []
    };

    if (data.customer_note)
        wooData["customer_note"] = data.customer_note;

    if (data.shipping_lines.find(line => line.method_id === 'econt_shipping_method')) {
        // Econt
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
    } else if (data.shipping_lines.find(line => line.method_id === 'speedy_shipping_method')) {
        // Speedy
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

    //TODO Implement normal shipping (get customer address instead of this. This is used in emo-sklad only, because they dont offer shipping to address, only econt and speedy)
    if (!wooData.woocommerce.speedy && !wooData.woocommerce.econt)
        wooData.woocommerce.shipping = data.shipping_lines[0]?.method_title || 'Бърза поръчка по телефон';

    if (data.coupon_lines.length > 0)
        wooData.coupons = data.coupon_lines;

    // Check if customer already in db
    var customer;
    customer = await Customer.findOne({ "woocommerce.id": data.customer_id, "woocommerce.woo_url": shop.url });

    // Try to find by email
    if (!customer && wooData.customer?.email)
        customer = await Customer.findOne({ email: wooData.customer.email });
    // Try to find by vat
    if (!customer && wooData.customer?.vat?.length > 0 && wooData.customer.vat.match(/^\d{9,15}$/gm))
        customer = await Customer.findOne({ vat: wooData.customer.vat })
    if (!customer) customer = null;

    // Products
    let index = 0;
    for (let product of data.line_items) {
        const productInDb = await Product.findOne({ "woocommerce.id": product.product_id.toString(), "woocommerce.woo_url": shop.url, code: product.sku });
        if (!productInDb) return { status: 404, message: 'Продуктът не е намерен' };
        const dbPrice = shop.custom.type === 'wholesale' ? (productInDb.saleWholesalePrice || productInDb.wholesalePrice) : productInDb.retailPrice;

        let discount = 0;
        // Check if the product price is different from the one in the database. If its differennt, calculate the % difference and set as product discount
        const siteDiscount = parseFloat(Math.abs(((product.price - dbPrice) / dbPrice) * 100).toFixed(2));


        /* This code checks if the web price is different from the one in the database. If it is, apply it as discount. Otherwise check if the customer already exists in the DB and has a discount set. Not used currently.
        */
        if (siteDiscount && siteDiscount !== 0) discount = siteDiscount;
        else if (customer?.discount && customer.discount !== 0) discount = customer.discount;
        const productData = {
            index: index++,
            id: product.product_id,
            product: productInDb._id,
            unitOfMeasure: productInDb.unitOfMeasure,
            quantity: Number(product.quantity),
            price: Number(dbPrice),
            discount,
        }

        //TODO Edit this when sale price is implemented to check sale price as well

        ///////////////////////////
        if (shop.custom.type === 'wholesale' || productInDb.sizes.length === 0) {
            if (productInDb.quantity < product.quantity) return { status: 400, message: 'Няма достатъчно количество от продукта: ' + productInDb.name + ' (наличност: ' + productInDb.quantity + ')' + `[${productInDb.code}]` };

            // If variable product, select all sizes
            if (productInDb.sizes.length)
                productData.selectedSizes = productInDb.sizes.map(s => s.size)

            if (productInDb.multiplier)
                productData.multiplier = productInDb.multiplier;
        } else if (shop.custom.type === 'retail' && productInDb.sizes.length > 0) {
            const selectedSize = productInDb.sizes.find(size => size.woocommerce.some(item => item.woo_url === shop.url && item.id === product.variation_id.toString()
            ));

            if (selectedSize.quantity < product.quantity) return { status: 400, message: `Няма достатъчно количество от продукта: ${productInDb.name} с размер ${selectedSize.size} (наличност: ${selectedSize.quantity}) [${productInDb.code}]` };

            productData.size = selectedSize.size;
        }

        ///////////////////////////

        wooData.products.push(productData);
    }

    if (customer && (customer.woocommerce?.length === 0 || !customer.woocommerce?.find(el => el.woo_url === shop.url))) {
        // Customer found in DB but not connected to this shop. Add shop customer id to customer db
        customer.woocommerce.push({ id: wooData.customer.id, woo_url: shop.url });
        await customer.save();
    } else if (!customer) {
        // Create new customer
        if (shop.custom.type === 'wholesale' && wooData.customer.vat?.length > 0 && !wooData.customer.vat.match(/^\d{9,15}$/gm)) {
            // Check if customer entered VAT number or company name
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

    await WooUpdateQuantityProducts(updatedProducts);

    return { status, message, order, updatedProducts }
}

export async function WooUpdateOrder({ id, updatedProducts }) {
    if (WooCommerce_Shops.length === 0) return;

    const order = await Order.findById(id).populate('products.product');

    if (!order) return { status: 404, message: 'Продажбата не е намерен' };

    if (!order?.woocommerce?.id) // Order was not made from woo, just update product quantity
        return await WooUpdateQuantityProducts(updatedProducts);

    if (!Object.keys(woocommerce.status).includes(order.woocommerce.status)) return { status: 400, message: 'Невалиден статус за поръчка' };

    if (!Object.keys(woocommerce.payment_method).includes(order.woocommerce.payment_method)) return { status: 400, message: 'Невалиден тип на плащане за поръчка' };

    const shop = WooCommerce_Shops.find(el => el.url === order.woocommerce.woo_url);

    // Get Woo Order
    const req = await shop.get(`orders/${order.woocommerce.id}`);
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
        const productInDB = product.product;
        if (!productInDB) continue; // Skip if product doesnt exist in WooCommerce

        // Check if product in Woo
        if (!productInDB?.woocommerce?.length === 0 || productInDB?.deleted === true || productInDB?.hidden === true) continue; // Skip if product doesnt exist in WooCommerce, is deleted or is hidden

        wooData.line_items.push({
            product_id: product.product.woocommerce.find(el => el.woo_url === shop.url).id,
            quantity: product.quantity,
            price: product.price,
            subtotal: (product.price * product.quantity).toFixed(2),
            total: ((product.price * product.quantity) * (100 - product.discount) / 100).toFixed(2),
            ...(shop.custom.type === 'retail' && product?.size && {
                // Variable product, add size variation
                variation_id: productInDB.sizes.find(s => s.size === product.size).woocommerce.find(el => el.woo_url === shop.url).id
            })
        });
    }

    await shop.put(`orders/${order.woocommerce.id}`, wooData);
    console.log('Order successfully edited in WooCommerce!')

    await WooUpdateQuantityProducts(updatedProducts);
}

export async function WooCancelOrder(id, updatedProducts) {
    if (WooCommerce_Shops.length === 0) return;

    const order = await Order.findById(id).populate('products.product');

    if (!order) return { status: 404, message: 'Продажбата не е намерена' };

    if (!order?.woocommerce?.id) // Order was not made from woo, just update product quantity
        return await WooUpdateQuantityProducts(updatedProducts);

    const shop = WooCommerce_Shops.find(el => el.url === order.woocommerce.woo_url);

    await shop.put(`orders/${order.woocommerce.id}`, { status: 'cancelled' }).then(async () => {
        console.log('Order status successfully changed to "Canceled" in WooCommerce!');
        await WooUpdateQuantityProducts(updatedProducts);
    }).catch((error) => {
        console.error('Error updating order status to "Canceled" in WooCommerce!');
        console.error(error);
    });
}

export async function WooRestoreOrder(id, updatedProducts) {
    if (WooCommerce_Shops.length === 0) return;

    const order = await Order.findById(id).populate('products.product');

    if (!order) return { status: 404, message: 'Продажбата не е намерена' };

    if (!order?.woocommerce?.id) // Order was not made from woo, just update product quantity
        return await WooUpdateQuantityProducts(updatedProducts);

    const shop = WooCommerce_Shops.find(el => el.url === order.woocommerce.woo_url);

    await shop.put(`orders/${order.woocommerce.id}`, { status: 'processing' }).then(async () => {
        console.log('Order restored in WooCommerce!');
        await WooUpdateQuantityProducts(updatedProducts);
    }).catch((error) => {
        console.error('Error updating order status to "Canceled" in WooCommerce!');
        console.error(error);
    });
}