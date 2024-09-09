import { WooCommerce } from "../config/woocommerce.js";
// On start, check if import all orders from WOO to MONGO (non existing only)

// Test user in woo:
// user: test
// pass: %d54x#)BJ@T01DXh(zegbhhJ

// Normal order with customer address: #51532
// Normal order with customer address + 10% discount coupon used: #51534
// Normal order with customer address + 1 product on sale and 1 normal product: #51539
// Order with Econt office: #51543
// Order with Econt customer address: #51542
// Order with Speedy оffice: #51545
// Order with Speedy customer address: #51544

export async function testWooOrderGet() {
    if (!WooCommerce) return;

    const response = await WooCommerce.get('orders/51545');
    const data = response.data;

    const wooOrder = {
        id: data.id,
        number: data.number,
        date_created: data.date_created,
        status: data.status,
        total: Number(data.total),
        discount_total: Number(data.discount_total),
        billing: data.billing,
        // shipping: data.shipping,
        payment_method: data.payment_method,
        payment_method_title: data.payment_method_title,
        products: []
    };

    if (data.customer_note)
        wooOrder["customer_note"] = data.customer_note;

    // Speedy shipping
    if (data.meta_data.find(meta => meta.key === 'speedy_shipping_to')?.value && data.meta_data.find(meta => meta.key === 'speedy_shipping_to')?.value !== '') {
        // General info for both address and office pickups
        wooOrder.speedy = {
            country: data.meta_data.find(meta => meta.key === 'speedy_country_name').value,
            locality: data.meta_data.find(meta => meta.key === 'speedy_site_name').value,
            post_code: data.meta_data.find(meta => meta.key === 'speedy_post_code').value,
            service: data.meta_data.find(meta => meta.key === 'speedy_destination_services_name').value,
            total: data.meta_data.find(meta => meta.key === 'speedy_total_price').value
        }

        // Office
        if (data.meta_data.find(meta => meta.key === 'speedy_shipping_to').value === 'OFFICE') {
            wooOrder.speedy.office = data.meta_data.find(meta => meta.key === 'speedy_pickup_office_name').value;

        }
        // Address
        else if (data.meta_data.find(meta => meta.key === 'speedy_shipping_to')?.value === 'ADDRESS') {
            wooOrder.speedy.street = data.meta_data.find(meta => meta.key === 'speedy_street_name').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_street_no')?.value)
                wooOrder.speedy.number = data.meta_data.find(meta => meta.key === 'speedy_street_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_entrance_no')?.value)
                wooOrder.speedy.entrance = data.meta_data.find(meta => meta.key === 'speedy_entrance_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_floor_no')?.value)
                wooOrder.speedy.floor = data.meta_data.find(meta => meta.key === 'speedy_floor_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_apartment_no')?.value)
                wooOrder.speedy.apartment = data.meta_data.find(meta => meta.key === 'speedy_apartment_no').value;

            if (data.meta_data.find(meta => meta.key === 'speedy_address_note')?.value)
                wooOrder.speedy.note = data.meta_data.find(meta => meta.key === 'speedy_address_note').value;
        }

    }

    // Econt shipping
    if (data.meta_data.find(meta => meta.key === 'Econt_Shipping_To')?.value && data.meta_data.find(meta => meta.key === 'Econt_Shipping_To')?.value !== '') {
        // Office
        if (data.meta_data.find(meta => meta.key === 'Econt_Shipping_To').value === 'OFFICE') {
            wooOrder.econt = {
                type: 'OFFICE',
                city: data.meta_data.find(meta => meta.key === 'Econt_Office_Town').value,
                office: data.shipping.address_1,
                post_code: data.meta_data.find(meta => meta.key === 'Econt_Office_Postcode').value,
                total: Number(data.meta_data.find(meta => meta.key === 'Econt_Total_Shipping_Cost').value)
            }
        }

        // Address
        if (data.meta_data.find(meta => meta.key === 'Econt_Shipping_To').value === 'DOOR') {
            wooOrder.econt = {
                type: 'DOOR',
                city: data.meta_data.find(meta => meta.key === 'Econt_Door_Town').value,
                post_code: data.meta_data.find(meta => meta.key === 'Econt_Door_Postcode').value,
                street: data.meta_data.find(meta => meta.key === 'Econt_Door_Street').value,
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_street_num').value && { number: data.meta_data.find(meta => meta.key === 'Econt_Door_street_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Entrance_num').value && { entrance: data.meta_data.find(meta => meta.key === 'Econt_Door_Entrance_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Floor_num').value && { floor: data.meta_data.find(meta => meta.key === 'Econt_Door_Floor_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Apartment_num').value && { apartment: data.meta_data.find(meta => meta.key === 'Econt_Door_Apartment_num').value }),
                ...(data.meta_data.find(meta => meta.key === 'Econt_Door_Other').value && { other: data.meta_data.find(meta => meta.key === 'Econt_Door_Other').value }), // could be a door note or address if it cant be found in the Econt form
                total: Number(data.meta_data.find(meta => meta.key === 'Econt_Total_Shipping_Cost').value)
            }
        }
    }

    if (!wooOrder.speedy && !wooOrder.econt)
        wooOrder.shipping = {
            title: data.shipping_lines.method_title,
            id: data.shipping_lines.method_id,
        }

    if (data.coupon_lines.length > 0)
        wooOrder.coupons = data.coupon_lines;


    // Products
    for (let product of data.line_items) {
        wooOrder.products.push({
            id: product.product_id,
            quantity: product.quantity,
            price: product.price, // this value includes coupon discounts and sale price (ex. if price was 10lv originally and 10% coupon was applied, price will be 9lv) (or if product price is 15lv, but on sale for 12lv this will show 12lv)
            subtotal: Number(product.subtotal), // this value does NOT include coupon discounts
            total: Number(product.total) // this value INCLUDES coupon discounts
        })
    }



    console.log(wooOrder)
    // TODO Transform woo products to fit our model for orders and use OrderController to create order
}