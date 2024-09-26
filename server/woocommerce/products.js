import { WooCommerce } from "../config/woocommerce.js";
import { Category } from "../models/category.js";
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
        { // This is used for the viber url to display size correctly
            name: 'Размер за Viber',
            slug: 'size_viber',
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
                    const inMongo = mongoAttributes.find(m => 'pa_' + m.slug == existingAttribute.slug);

                    if (inMongo) {
                        inMongo.woocommerce.id = existingAttribute.id;
                        inMongo.save();
                    } else {
                        attribute.woocommerce = { id: existingAttribute.id };
                        ProductAttribute.create(attribute);
                    }

                    break;
                }
            }

            if (!found) {
                WooCommerce.post("products/attributes", attribute).then(() => {
                    // Success
                    console.log(`Attribute "${attribute.name}" successfully created in WooCommerce!`)

                    // Check if attribute exists in mongodb
                    const inMongo = mongoAttributes.find(m => m.slug == attribute.slug);

                    if (inMongo) {
                        inMongo.woocommerce.id = attribute.id;
                        inMongo.save();
                    } else {
                        attribute.woocommerce = { id: attribute.id };
                    }
                    ProductAttribute.create(attribute);
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

//TODO Add this to README.md and make a section woocommerce setup
/* NOTE this is a custom filter, must be added to snippets or functions.php file:
add_filter( 'woocommerce_rest_prepare_product_object', 'my_woocommerce_rest_prepare_product_object', 10, 3 );

function my_woocommerce_rest_prepare_product_object( $response, $object, $request ) {
    $data = $response->get_data();
    $newdata = [];

    if ($request['fields'] != null)
    {
        foreach ( explode ( ",", $request['fields'] ) as $field )
            $newdata[$field] = $data[$field];

        $response->set_data( $newdata );
    }

    return $response;
}
*/


export async function WooUpdateQuantityProducts(products) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p.woocommerce.id); // only find products that are in WooCommerce (some can be hidden)

    const data = {
        update: filtered.map(p => ({ id: p.woocommerce.id, stock_quantity: p.quantity })),
    }

    WooCommerce.post('products/batch', data).then(() => {
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
        slug: "p" + product.code,
        description: product.description,
        regular_price: product.wholesalePrice.toString(),
        sku: product.code,
        categories: [{ id: category.woocommerce.id }],
        stock_quantity: product.quantity,
        "manage_stock": true, // enables the stock management
    }

    // If not in live environment, set product status as private to not show it for clients
    if (process.env.ENV === 'dev') {
        data.status = 'private';
        data.catalog_visibility = 'hidden';
    }

    if (product.sizes.length > 0) {
        const mongoAttributes = await ProductAttribute.find({});

        const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
        const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
        const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
        const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;

        const simpleSizes = product.sizes.map(s => s.size);
        const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

        data.attributes = [
            { // pcs
                id: pcsId,
                visible: true,
                variation: false,
                options: (product.sizes.length * product.multiplier).toString(),
                //TODO TEST IF MULTIPLIER WORSK IN WOOCOMMERCE
            },
            { // size
                id: sizeId,
                visible: true,
                variation: false,
                options: simpleSizes
            },
            { // viber size
                id: viberSizeId,
                visible: false,
                variation: false,
                options: viberSizes// Get the first and last size and do 'X-Y'
            },
            { // piecePrice
                id: piecePriceId,
                visible: true,
                variation: false,
                options: (product.wholesalePrice / (product.sizes.length * product.multiplier)).toFixed(2).toString(),
                //TODO TEST IF MULTIPLIER WORSK IN WOOCOMMERCE
            },
        ]
    }

    if (process.env.ENV !== 'dev' && product.image) {
        data.images = [{ src: `${process.env.URL}${product.image}` }];

        if (product.additionalImages) {
            for (const image of product.additionalImages)
                data.images.push({ src: `${process.env.URL}${image}` });
        }
    }

    WooCommerce.post("products", data).then((response) => {
        // Success
        console.log("Product successfully created in WooCommerce!")
        product.woocommerce = {
            id: response.data.id,
            permalink: response.data.permalink
        }
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
    const data = {
        name: newProductData.name,
        slug: "p" + newProductData.code,
        description: newProductData.description,
        regular_price: newProductData.wholesalePrice.toString(),
        sku: newProductData.code,
        stock_quantity: newProductData.quantity,
    }
    const category = await Category.findById(newProductData.category);
    if (category) data.categories = [{ id: category.woocommerce.id }];

    if (newProductData.sizes.length > 0) {
        const mongoAttributes = await ProductAttribute.find({});

        const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
        const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
        const viberSizeId = mongoAttributes.find(m => m.slug == 'size_viber').woocommerce.id;
        const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;

        const simpleSizes = newProductData.sizes.map(s => s.size);
        const viberSizes = `${simpleSizes[0]}-${simpleSizes[simpleSizes.length - 1]}`;

        data.attributes = [
            { // pcs
                id: pcsId,
                visible: true,
                variation: false,
                options: newProductData.sizes.length.toString()
            },
            { // size
                id: sizeId,
                visible: true,
                variation: false,
                options: simpleSizes
            },
            { // viber size
                id: viberSizeId,
                visible: false,
                variation: false,
                options: viberSizes // Get the first and last size and do 'X-Y'
            },
            { // piecePrice
                id: piecePriceId,
                visible: true,
                variation: false,
                options: (newProductData.wholesalePrice / newProductData.sizes.length).toFixed(2).toString()
            },
        ]
    } else data.attributes = [];

    if (process.env.ENV !== 'dev' && newProductData.image) {
        data.images = [{ src: `${process.env.URL}${newProductData.image}` }];

        if (newProductData.additionalImages) {
            for (const image of newProductData.additionalImages)
                data.images.push({ src: `${process.env.URL}${image}` });
        }
    }

    WooCommerce.put(`products/${oldProductData.woocommerce.id}`, data).then(() => {
        // Success
        console.log('Product successfully edited in WooCommerce!')
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}

export async function WooDeleteProduct(id) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    WooCommerce.delete(`products/${id}`).then(() => {
        // Success
        console.log('Product successfully deleted in WooCommerce!')
    }).catch((error) => {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
    });
}