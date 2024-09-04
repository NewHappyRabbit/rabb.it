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
                        inMongo.woocommerce.id = existingAttribute.id;
                        inMongo.save();
                    } else {
                        attribute.woocommerce = { id: existingAttribute.id };
                    }
                    ProductAttribute.create(attribute);

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

export async function WooGetAllProductURLS() {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

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

    // Find all products with permalinks
    const productsURLS = await Product.find({ outOfStock: { $ne: true }, "woocommerce.permalink": { $exists: true } }).select('woocommerce.permalink -_id').lean();

    return productsURLS.map(p => p.woocommerce.permalink);
}

export async function WooUpdateQuantityProducts(products) {
    if (!WooCommerce) return; // If woocommerce wasnt initalized or is not used

    const filtered = products.filter(p => p.woocommerce.id); // only find products that are in WooCommerce (some can be hidden)

    const data = {
        update: filtered.map(p => ({ id: p.woocommerce.id, stock_quantity: p.quantity })),
    }

    WooCommerce.post('products/batch', data).then(() => {
        // Success
        console.log('Products quantity successfully updated in WooCommerce after order creation!')
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
    if (process.env.ENV !== 'live') {
        data.status = 'private';
        data.catalog_visibility = 'hidden';
    }

    if (product.sizes.length > 0) {
        const mongoAttributes = await ProductAttribute.find({});

        const pcsId = mongoAttributes.find(m => m.slug == 'pcs').woocommerce.id;
        const sizeId = mongoAttributes.find(m => m.slug == 'size').woocommerce.id;
        const piecePriceId = mongoAttributes.find(m => m.slug == 'pieceprice').woocommerce.id;

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
    /*const data = {};
     if (oldProductData.name !== newProductData.name) data.name = newProductData.name;

    if (oldProductData.description !== newProductData.description) data.description = newProductData.description;

    if (oldProductData.code !== newProductData.code) data.sku = newProductData.code;

    if (oldProductData.wholesalePrice.toString() !== newProductData.wholesalePrice.toString()) data.regular_price = newProductData.wholesalePrice.toString();

    if (oldProductData.category !== newProductData.category) {
        const category = await Category.findById(newProductData.category);

        data.categories = [{ id: category.woocommerce.id }];
    }
    if (oldProductData.quantity.toString() !== newProductData.quantity.toString()) data.stock_quantity = newProductData.quantity; */

    //TODO TEST IF IMAGES WORK ON LIVE SERVER
    //TODO I think if no image is passed it will delete the images in the product, test to see. If not, check if the img is different
    if (process.env.ENV !== 'dev' && newProductData.image) {
        //TODO Test if images are uploading on live site
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