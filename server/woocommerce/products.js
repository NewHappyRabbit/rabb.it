import { appURL } from "../app.js";
import { WooCommerce } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
import { slugify } from "../models/functions/global.js";
import { Product } from "../models/product.js";
import { ProductAttribute } from "../models/product_attribute.js";

// REST API Documentation: https://woocommerce.github.io/woocommerce-rest-api-docs/

export async function WooCheckProductAttributesINIT() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    // Check if all products attributes exist in WooCommerce, if not - create them

    // Attributes are hard-coded for now
    const attributes = [
        {
            name: 'Бройки в серия',
            slug: 'pcs',
            order_by: 'name_num'
        },
        {
            name: 'Цена на брой',
            slug: 'pieceprice',
            order_by: 'name_num'
        },
        {
            name: 'Размер',
            slug: 'size',
            order_by: 'name_num'
        },
        {
            name: 'Тест',
            slug: 'test',
            order_by: 'name_num'
        },
    ];

    WooCommerce.get("products/attributes").then(async (response) => {
        const mongoAttributes = await ProductAttribute.find({});
        for (const attribute of attributes) {
            let found = false;



            for (const existingAttribute of response.data) {
                if (existingAttribute.name == attribute.name) {
                    found = true;

                    // Check if attribute exists in mongodb
                    const inMongo = mongoAttributes.find(m => m.slug == attribute.slug);

                    if (inMongo) {
                        inMongo.wooId = existingAttribute.id;
                        inMongo.save();
                    } else
                        ProductAttribute.create({ ...attribute, wooId: existingAttribute.id });

                    break;
                }
            }

            if (!found) {
                WooCommerce.post("products/attributes", attribute).then((response) => {
                    // Success
                    console.log(`Attribute "${attribute.name}" successfully created in WooCommerce!`)

                    // Check if attribute exists in mongodb
                    const inMongo = mongoAttributes.find(m => m.slug == attribute.slug);

                    if (inMongo) {
                        inMongo.wooId = attribute.id;
                        inMongo.save();
                    } else
                        ProductAttribute.create({ ...attribute, wooId: attribute.id });
                }).catch((error) => {
                    // Invalid request, for 4xx and 5xx statuses
                    console.error("Response Status:", error.response.status);
                    console.error("Response Headers:", error.response.headers);
                    console.error("Response Data:", error.response.data);
                });
            }
        }

        console.log("All products attributes exist in WooCommerce!")
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}

export async function WooCreateProductsINIT() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const products = await Product.find({});
    //TODO Use https://woocommerce.github.io/woocommerce-rest-api-docs/#batch-update-products instead of for each product
    for (const product of products) {
        WooCreateProduct(product);
    }
}

export async function WooGetAllProductURLS() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    /* NOTE this is a custom filter, must be added to snippets or functions.php file:
    add_filter( 'woocommerce_rest_prepare_product_object', 'my_woocommerce_rest_prepare_product_object', 10, 3 );
    function my_woocommerce_rest_prepare_product_object( $response, $object, $request ) { 

        $data = $response->get_data();
        $newdata = [];
        foreach ( explode ( ",", $request['fields'] ) as $field ) {
            $newdata[$field] = $data[$field];
        }
        $response->set_data( $newdata );

        return $response;
    }
    */

    //FIXME Instead of calling WooCommerce, why not save the url to the mongo db maybe? Test speed tomorrow. Average speed on woocommerce 22.2 seconds for 760 results


    const getAllProducts = async (offset) => {
        return await WooCommerce.get('products?fields=permalink', {
            per_page: 100,
            offset,
            stock_status: 'instock',
            status: 'publish'
        }).then(async (response) => {
            // Success
            return response.data;
        }).catch((error) => {
            // Invalid request, for 4xx and 5xx statuses
            console.error("Response Status:", error.response.status);
            console.error("Response Headers:", error.response.headers);
            console.error("Response Data:", error.response.data);
        });
    }

    // until the last page
    let data = [];
    let offset = 0;
    const start = Date.now();

    do {
        const products = await getAllProducts(offset);
        if (!products || products.length == 0) break;
        data = data.concat(products);
        offset += 100;
    } while (true);
    console.log(`Took ${Date.now() - start}ms to get all products from WooCommerce.`)

    return data.map(p => p.permalink);
}

export async function WooUpdateQuantityProducts(products) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p.wooId); // only find products that are in WooCommerce (some can be hidden)

    const data = {
        update: filtered.map(p => ({ id: p.wooId, stock_quantity: p.quantity })),
    }

    WooCommerce.post('products/batch', data).then((response) => {
        // Success
        console.log('Products quantity successfully updated in WooCommerce!')
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}

export async function WooCreateProduct(product) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const category = await Category.findById(product.category);

    const data = {
        name: product.name,
        slug: slugify(product.name),
        description: product.description,
        regular_price: product.wholesalePrice.toString(),
        sku: product.code,
        categories: [{ id: category.wooId }],
        stock_quantity: product.quantity,
        "manage_stock": true, // enables the stock management
    }

    if (product.sizes.length > 0) {
        const mongoAttributes = await ProductAttribute.find({});

        const pcsId = mongoAttributes.find(m => m.slug == 'pcs').wooId;
        const sizeId = mongoAttributes.find(m => m.slug == 'size').wooId;
        const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').wooId;

        data.attributes = [
            { // pcs
                id: pcsId,
                visible: true,
                variation: false,
                options: product.sizes.length.toString()
            },
            { // size
                id: sizeId,
                visible: true,
                variation: false,
                options: product.sizes.map(s => s.size)
            },
            { // piecePrice
                id: piecePriceId,
                visible: true,
                variation: false,
                options: (product.wholesalePrice / product.sizes.length).toFixed(2).toString()
            },
        ]
    }

    if (process.env.ENV !== 'dev' && product.image) {
        //TODO Test if images are uploading on live site
        data.images = [{ src: `${appURL}${product.image}` }];

        if (product.additionalImages) {
            for (const image of product.additionalImages)
                data.images.push({ src: `${appURL}${image}` });
        }
    }

    WooCommerce.post("products", data).then((response) => {
        // Success
        console.log("Product successfully created in WooCommerce!")

        // add woo id to product
        product.wooId = response.data.id;
        product.save();
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}

export async function WooEditProduct(oldProductData, newProductData) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used
    const data = {};
    if (oldProductData.name !== newProductData.name) data.name = newProductData.name;

    if (oldProductData.description !== newProductData.description) data.description = newProductData.description;

    if (oldProductData.code !== newProductData.code) data.sku = newProductData.code;

    if (oldProductData.wholesalePrice.toString() !== newProductData.wholesalePrice.toString()) data.regular_price = newProductData.wholesalePrice.toString();

    if (oldProductData.category !== newProductData.category) {
        const category = await Category.findById(newProductData.category);

        data.categories = [{ id: category.wooId }];
    }
    if (oldProductData.quantity.toString() !== newProductData.quantity.toString()) data.stock_quantity = newProductData.quantity;

    //TODO TEST IF IMAGES WORK ON LIVE SERVER
    //TODO I think if no image is passed it will delete the images in the product, test to see. If not, check if the img is different
    if (process.env.ENV !== 'dev' && newProductData.image) {
        //TODO Test if images are uploading on live site
        data.images = [{ src: `${appURL}${product.image}` }];

        if (newProductData.additionalImages) {
            for (const image of product.additionalImages)
                data.images.push({ src: `${appURL}${image}` });
        }
    }

    WooCommerce.put(`products/${oldProductData.wooId}`, data).then((response) => {
        // Success
        console.log('Product successfully edited in WooCommerce!')
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}

export async function WooDeleteProduct(wooId) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    WooCommerce.delete(`products/${wooId}`).then((response) => {
        // Success
        console.log('Product successfully deleted in WooCommerce!')
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}