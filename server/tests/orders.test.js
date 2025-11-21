import 'dotenv/config';
import { afterAll, describe, expect, test } from 'vitest'
import { mongoConfig } from '../config/database.js'
import { setEnvVariables } from './common.js';
import { Product } from '../models/product.js';
import { documentTypes, Order, orderTypes, paymentTypes, woocommerce } from '../models/order.js';
import { OrderController } from '../controllers/orders.js';
import { Customer } from '../models/customer.js';
import { Company } from '../models/company.js';
import { Category } from '../models/category.js';
import { User } from '../models/user.js';

setEnvVariables();
await mongoConfig();

afterAll(async () => {
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Category.deleteMany({});
    await Company.deleteMany({});
    await Customer.deleteMany({});
});

const company = await Company.create({
    "bank": {
        "name": "Райфайзен Банк АД",
        "code": "RZBBSF",
        "iban": "BG12RZBB91551012345678"
    },
    "name": "Сиско Трейд ЕТ",
    "mol": "Свилен Емилов",
    "phone": "0891231233",
    "vat": "999999999",
    "country": "България",
    "state": "Русе",
    "city": "Бяла",
    "street": "ул. Шипка 10",
    "senders": [
        "Иван Иванов",
    ],
    "default": true,
    "taxvat": "BG999999999",
    "tax": 20,
    "address": "fff"
});

const category = await Category.create({
    "name": "Category 0",
    "slug": "category-0",
    "path": null,
    "order": 0,
    "depth": []
})

const simpleProductData = {
    "category": category._id,
    "code": "1643",
    "barcode": "0000000016438",
    "name": "Simple",
    "description": "",
    "unitOfMeasure": "бр.",
    "quantity": 100,
    "minQty": null,
    "sizes": [],
    "deliveryPrice": 10,
    "wholesalePrice": 13,
    "retailPrice": 15.5,
    "hidden": false,
    "deleted": false,
    "outOfStock": false,
    "additionalImages": [],
};

const variableProductData = {
    "category": category._id,
    "code": "1644",
    "barcode": "0000000016445",
    "name": "Variable",
    "description": "",
    "unitOfMeasure": "пакет",
    "quantity": 100,
    "minQty": null,
    "sizes": [
        {
            "size": "S",
            "quantity": 100
        },
        {
            "size": "M",
            "quantity": 100
        },
        {
            "size": "L",
            "quantity": 100
        }
    ],
    "deliveryPrice": 30,
    "wholesalePrice": 39,
    "retailPrice": 15.5,
    "hidden": false,
    "deleted": false,
    "outOfStock": false,
    "additionalImages": [],
};

const customer = await Customer.create({
    "name": "ff",
    "mol": "ff",
    "vat": "1444444441",
    "address": "fff",
    "receivers": [
        "ff"
    ],
    "deleted": false,
    "taxvat": "445"
});

const admin = await User.create({
    username: 'test',
    password: 'test',
    role: 'admin'
});

const validOrderData = {
    "date": "2024-09-16",
    "type": "stokova",
    "number": "123",
    "customer": customer._id,
    "orderType": "wholesale",
    "products": [
        {
            "index": 0,
            "name": "Simple non-existing",
            "quantity": "4",
            "price": "6",
            "discount": 0,
            "unitOfMeasure": "пакет"
        },
    ],
    "paymentType": "cash",
    "paidAmount": 0,
    "company": company._id,
    "receiver": "HH",
    "sender": "GG",
    "user": admin._id,
    "total": "50",
};

//TODO Add tests for order.unpaid, order.total

describe('POST /orders', async () => {
    describe('Wholesale order', async () => {
        const simpleProduct = await Product.create(simpleProductData);
        const variableProduct = await Product.create(variableProductData);

        const data = {
            "date": "2024-09-16",
            "type": "stokova",
            "customer": customer._id,
            "orderType": "wholesale",
            "products": [
                { // simple product
                    "index": 0,
                    "product": simpleProduct._id,
                    "quantity": "2",
                    "price": 13,
                    "discount": "10",
                    "unitOfMeasure": "бр."
                },
                {
                    "index": 1,
                    "product": variableProduct._id,
                    "quantity": "5",
                    "price": 39,
                    "discount": 0,
                    "selectedSizes": [
                        "S",
                        "M",
                        "L"
                    ],
                    "unitOfMeasure": "пакет"
                },
                {
                    "index": 2,
                    "name": "Simple non-existing",
                    "quantity": "4",
                    "price": "6",
                    "discount": 0,
                    "unitOfMeasure": "пакет"
                },
                {
                    "index": 3,
                    "name": "Variable non-existing",
                    "quantity": "7",
                    "price": "3",
                    "qtyInPackage": 3,
                    "discount": 0,
                    "unitOfMeasure": "пакет"
                }
            ],
            "paymentType": "cash",
            "paidAmount": 0,
            "company": company._id,
            "receiver": "HH",
            "sender": "GG"
        };

        const { status, order, updatedProducts } = await OrderController.post({ data, userId: admin._id });

        test('Data is correct', () => {
            expect(status).toBe(201);
            expect(order.number).toBe("1");
            expect(order.date).toStrictEqual(new Date(data.date));
            expect(updatedProducts.length).toBe(2);
            expect(order.customer.toString()).toBe(customer._id.toString());
            expect(order.orderType).toBe('wholesale');
            expect(order.paymentType).toBe('cash');
            expect(order.products.length).toBe(4);
            expect(order.company.toString()).toBe(company._id.toString());
            expect(order.type).toBe('stokova');
            expect(order.paidAmount).toBe(0);
            expect(order.receiver).toBe(data.receiver);
            expect(order.sender).toBe(data.sender);
            //TODO Check total price
        });

        test('New customer receiver added', async () => {
            const updatedCustomer = await Customer.findById(customer._id);
            expect(updatedCustomer.receivers.length).toBe(2);
            expect(updatedCustomer.receivers[1]).toBe(data.receiver);
        });

        test('New company sender added', async () => {
            const updatedCompany = await Company.findById(company._id);
            expect(updatedCompany.senders.length).toBe(2);
            expect(updatedCompany.senders[1]).toBe(data.sender);
        });

        test('Products quantities are removed', async () => {
            const updatedSimpleProduct = await Product.findById(simpleProduct._id);
            const updatedVariableProduct = await Product.findById(variableProduct._id);
            expect(updatedSimpleProduct.quantity).toBe(98);
            expect(updatedVariableProduct.quantity).toBe(95);
            expect(updatedVariableProduct.sizes.find(s => s.size === 'S').quantity).toBe(95);
            expect(updatedVariableProduct.sizes.find(s => s.size === 'M').quantity).toBe(95);
            expect(updatedVariableProduct.sizes.find(s => s.size === 'L').quantity).toBe(95);
        });
    });

    describe('Retail order', async () => {
        const simpleProduct = await Product.create(simpleProductData);
        const variableProduct = await Product.create(variableProductData);

        const data = {
            "date": "2024-09-16",
            "type": "stokova",
            "customer": customer._id,
            "orderType": "retail",
            "products": [
                {
                    "index": 0,
                    "product": simpleProduct._id,
                    "quantity": 6,
                    "price": 15.5,
                    "discount": 0,
                    "unitOfMeasure": "бр."
                },
                {
                    "index": 1,
                    "product": variableProduct._id,
                    "quantity": 2,
                    "price": 15.5,
                    "size": "S",
                    "discount": "20",
                    "unitOfMeasure": "пакет"
                },
                {
                    "index": 2,
                    "name": "Simple non-existing",
                    "quantity": "3",
                    "price": "4",
                    "discount": 0,
                    "unitOfMeasure": "л."
                },
                {
                    "index": 3,
                    "name": "Variable non-existing",
                    "quantity": 1,
                    "price": "6",
                    "size": "L",
                    "discount": 0,
                    "unitOfMeasure": "бр."
                }
            ],
            "paymentType": "cash",
            "paidAmount": 0,
            "company": company._id,
            "receiver": "HH",
            "sender": "GG"
        }

        const { status, order, updatedProducts } = await OrderController.post({ data, userId: admin._id });

        test('Data is correct', () => {
            expect(status).toBe(201);
            expect(order.number).toBe("2");
            expect(order.date).toStrictEqual(new Date(data.date));
            expect(updatedProducts.length).toBe(2);
            expect(order.customer.toString()).toBe(customer._id.toString());
            expect(order.orderType).toBe('retail');
            expect(order.paymentType).toBe('cash');
            expect(order.products.length).toBe(4);
            expect(order.company.toString()).toBe(company._id.toString());
            expect(order.type).toBe('stokova');
            expect(order.paidAmount).toBe(0);
            expect(order.receiver).toBe(data.receiver);
            expect(order.sender).toBe(data.sender);
            //TODO Check total price
        });

        test('Products quantities are removed', async () => {
            const updatedSimpleProduct = await Product.findById(simpleProduct._id);
            const updatedVariableProduct = await Product.findById(variableProduct._id);
            expect(updatedSimpleProduct.quantity).toBe(94);
            expect(updatedVariableProduct.quantity).toBe(98);
            expect(updatedVariableProduct.sizes.find(s => s.size === 'S').quantity).toBe(98);
            expect(updatedVariableProduct.sizes.find(s => s.size === 'M').quantity).toBe(100);
            expect(updatedVariableProduct.sizes.find(s => s.size === 'L').quantity).toBe(100);
        });
    });

    describe('Validate', async () => {
        const simpleProduct = await Product.create(simpleProductData);
        const variableProduct = await Product.create(variableProductData);

        const data = {
            "date": "2024-09-16",
            "type": "stokova",
            "customer": customer._id,
            "orderType": "wholesale",
            "products": [
                { // simple product
                    "index": 0,
                    "product": simpleProduct._id,
                    "quantity": "2",
                    "price": 13,
                    "discount": "10",
                    "unitOfMeasure": "бр."
                },
                {
                    "index": 1,
                    "product": variableProduct._id,
                    "quantity": "5",
                    "price": 39,
                    "discount": 0,
                    "selectedSizes": [
                        "S",
                        "M",
                        "L"
                    ],
                    "unitOfMeasure": "пакет"
                },
                {
                    "index": 2,
                    "name": "Simple non-existing",
                    "quantity": "4",
                    "price": "6",
                    "discount": 0,
                    "unitOfMeasure": "пакет"
                },
                {
                    "index": 3,
                    "name": "Variable non-existing",
                    "quantity": "7",
                    "price": "3",
                    "qtyInPackage": 3,
                    "discount": 0,
                    "unitOfMeasure": "пакет"
                }
            ],
            "paymentType": "cash",
            "paidAmount": 0,
            "company": company._id,
            "receiver": "HH",
            "sender": "GG"
        };

        test('No date', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            delete temp.date;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('date');
        });

        test('No document type', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            delete temp.type;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('type');
        });

        test('No customer', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            delete temp.customer;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('customer');
        });

        test('Non-existing customer', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.customer = simpleProduct._id;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(404);
            expect(property).toBe('customer');
        });

        test('No order type', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            delete temp.orderType;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('orderType');
        });

        test('Non-existing order type', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.orderType = 'asdasd';
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('orderType');
        });

        test('No products', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            delete temp.products;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('products');
        });

        test('No selected size for wholesale', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[1].selectedSizes = [];
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('size');
        })

        test('No product id or name', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].product = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('product');
        });

        test('Non-existing product', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].product = '66cdc2935881796551ea88b5';
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(404);
            expect(property).toBe('product');
        });

        test('No quantity', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].quantity = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('quantity');
        });

        test('Quantity <= 0', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].quantity = 0;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('quantity');
        });

        test('No price', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].price = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('price');
        });

        test('Price < 0', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].price = -1;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('price');
        });

        test('Discount < 0', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].discount = -1;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('discount');
        });

        test('Discount > 100', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].discount = 101;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('discount');
        });

        test('No unit of measure', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.products[0].unitOfMeasure = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('unitOfMeasure');
        });

        test('No payment type', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.paymentType = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('paymentType');
        });

        test('Non-existing payment type', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.paymentType = 'asd';
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('paymentType');
        });

        test('Paid amount < 0', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.paidAmount = -1;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('paidAmount');
        });

        test('No company', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.company = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('company');
        });

        test('Non-existing company', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.company = '66cdc2935881796551ea88b5';
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('company');
        });

        test('No receiver', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.receiver = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('receiver');
        });

        test('No sender', async () => {
            const temp = JSON.parse(JSON.stringify(data));
            temp.sender = undefined;
            const { status, property } = await OrderController.post({ data: temp, userId: admin._id });
            expect(status).toBe(400);
            expect(property).toBe('sender');
        });
    });
});

test('GET /orders', async () => {
    await Order.create(validOrderData);
    const { orders } = await OrderController.get({});
    expect(orders.length).toBeGreaterThan(0);
});

describe('GET /orders/:id', async () => {
    test('Get order by id', async () => {
        const newOrder = await Order.create(validOrderData);
        const { status, order } = await OrderController.getById(newOrder._id);

        expect(status).toBe(200);
        expect(newOrder._id.toString()).toBe(order._id.toString());
    });

    test('Non-existing order', async () => {
        const { status } = await OrderController.getById('66df6c6f63ff5e701805e633');

        expect(status).toBe(404);
    });
});

test('GET /orders/params', async () => {
    const data = OrderController.getParams();
    expect(data.orderTypes).toEqual(orderTypes);
    expect(data.paymentTypes).toEqual(paymentTypes);
    expect(data.documentTypes).toEqual(documentTypes);
    expect(data.woocommerce).toEqual(woocommerce)
});

describe('PUT /orders/:id', async () => {
    describe('Update order', async () => {
        const newData = JSON.parse(JSON.stringify(validOrderData));
        newData.type = "invoice";
        newData.receiver = 'CC';
        newData.sender = 'CC';

        const newOrder = await Order.create(validOrderData);
        const { status } = await OrderController.put({ data: newData, id: newOrder._id });
        const order = await Order.findById(newOrder._id);

        test('Saved', async () => {
            expect(status).toBe(201);
        });

        test('New sender saved', async () => {
            const company = await Company.findById(newData.company);
            expect(company.senders.includes(newData.sender)).toBe(true);
        });

        test('New receiver saved', async () => {
            const customer = await Customer.findById(newData.customer);
            expect(customer.receivers.includes(newData.receiver)).toBe(true);
        });

        test('New order number on document type change', async () => {
            expect(order.documentType).toBe(newData.documentType);
            expect(order.number).not.toBe(newOrder.number);
        });
    });

    test('Non-existing order', async () => {
        const { status } = await OrderController.put({ data: validOrderData, id: '66df6c6f63ff5e701805e633' });
        expect(status).toBe(404);
    });
});

describe('DELETE /orders/:id', async () => {
    test('Delete order', async () => {
        const newOrder = await Order.create(validOrderData);
        const { status } = await OrderController.delete(newOrder._id);
        expect(status).toBe(204);

        const order = await Order.findById(newOrder._id);
        expect(order.deleted).toBe(true);
    });

    test('Non-existing order', async () => {
        const { status } = await OrderController.delete('66df6c6f63ff5e701805e633');
        expect(status).toBe(404);
    });
});