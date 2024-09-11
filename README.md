# Rabb.it - Inventory Management Web Application

This repository contains a web-based application designed to streamline inventory management and sales operations. The application provides robust features for managing products, orders, and invoices, making it ideal for businesses of all sizes.

### WooCommerce Integration

Seamlessly synchronize products and orders with your WooCommerce store, ensuring that your inventory is always up-to-date.

### Invoice Generation

Create and manage invoices directly within the application, simplifying your billing process.

### Product Flexibility

Support for both simple and variable products, allowing you to cater to a wide range of customer needs.

### Wholesale & Retail Sales

Sell products at wholesale or retail prices, with customizable pricing options.

---

## Key Features

### Inventory Management

The Inventory Management module is designed to give you comprehensive control over your products, allowing you to efficiently manage and track every aspect of your inventory. Below are the key features provided for product management:

-   **Product Details**: Each product in your inventory is represented with a rich set of details, ensuring you have all the information you need at your fingertips:

    -   **Featured Image**: Highlight your products with a primary image that represents them in listings and previews.
    -   **Additional Images**: Add multiple images to showcase your product from different angles or perspectives.
    -   **Category**: Organize your products into categories for easier browsing and management.
    -   **Name**: The product name, clearly displayed for easy identification.
    -   **SKU (Stock Keeping Unit)**: Assign a unique SKU to each product. If a SKU is not provided, the application will automatically generate one, ensuring that every product has a distinct identifier.
    -   **Barcode**: Store barcodes for easy scanning and inventory operations. Like the SKU, if a barcode is not provided, the system can automatically generate one.
    -   **Description**: Provide a detailed description of the product to inform potential customers or users about its features, benefits, and uses.
    -   **Pricing**:
        -   **Cost Price**: Set the cost price for products, which is the price at which your company purchases the goods. This allows for accurate profit margin calculations.
        -   **Wholesale Price**: Manage wholesale pricing for bulk orders, allowing you to cater to businesses and larger clients.
        -   **Retail Price**: Define the retail price for individual sales, ensuring consistent pricing across your sales channels.
        -   **Automated Pricing Adjustments**: Prices can be automatically generated based on a user-defined percentage. This allows you to easily adjust wholesale or retail prices in bulk by applying a percentage increase or decrease, saving time and ensuring consistent pricing strategies.

-   **Inventory Tracking**:

    -   **Quantity**: Keep track of the quantity of each product in your inventory. The application allows you to monitor stock levels in real-time and receive alerts when stock is low.
    -   **Sizes**: For products available in different sizes, easily manage and track the inventory of each variant.
    -   **Label Printing**: When creating a product, there's an option to automatically print labels based on the product quantity. By checking this option, labels are generated and printed, helping streamline the process of labeling products for inventory or sales.

-   **Restocking**: A dedicated page for restocking products allows you to efficiently update inventory levels. You can restock products by:

    -   **Scanning Barcodes**: Quickly add products to the restocking list using a barcode scanner.
    -   **Entering SKU**: Manually enter the SKU of the product to restock.
    -   **Choosing Quantity**: Specify the quantity to add to the inventory.
    -   **Selecting Sizes**: For variable products, choose which sizes to update with the new quantity, ensuring accurate inventory levels for each variant.

-   **Print Labels**: When viewing products, each has a dedicated button to manage label printing. You can select the number of labels you wish to print, facilitating efficient labeling for inventory management or sales.

-   **Category Management**: Organize your products into categories with the following features:
    -   **Create Categories**: Easily create new categories for your products, including an image that is used in WooCommerce to visually represent the category.
    -   **Order Categories**: Arrange categories in a custom order to determine how they are displayed in your store, providing flexibility in how products are presented to customers.
    -   **Nested Categories**: Create nested categories to organize products in a hierarchical structure, allowing for detailed categorization and improved product navigation.

This comprehensive approach to inventory management ensures that all aspects of your products are accounted for, making it easier to manage stock levels, pricing, and product details across your business operations.

### Customer Management

The Customer Management module allows you to efficiently manage your customer information, providing all the necessary details for smooth business operations. Below are the key features related to managing customers:

-   **Customer Details**: Each customer profile is rich with information to ensure you have everything needed to maintain strong relationships and process orders efficiently:
    -   **Company Name**: Store the name of the customer's company, which is essential for business-to-business transactions.
    -   **Responsible Person**: Record the name of the individual responsible for communication or decision-making within the customer's organization.
    -   **VAT Number**: Capture the customer's VAT number, necessary for tax and invoicing purposes.
    -   **Tax VAT**: Store additional tax-related VAT information if required, ensuring compliance with local tax regulations.
    -   **Billing Address**: Keep a record of the customer's main business address for billing and legal documentation.
    -   **Delivery Address**: Maintain a separate delivery address if it differs from the company's main address, facilitating smoother logistics and shipping processes.
    -   **Phone Number**: Record the customer's phone number for quick and efficient communication.
    -   **Email**: Store the customer's email address for electronic communication, invoicing, and order confirmations.
    -   **Discount Percentage**: Set a specific discount percentage for the customer, which can be automatically applied to their orders. This feature is particularly useful for managing long-term business relationships or offering special rates to valued clients.

This robust customer management feature set ensures that all customer-related information is organized and easily accessible, helping you maintain strong customer relationships and streamline order processing.

### Company Management

The Company Management module allows you to create and manage your own companies with detailed information to streamline your business operations. Below are the key features related to managing your companies:

-   **Company Details**: Each company includes all the information from the customer managment above, plus:
    -   **Bank Details**: Include bank details necessary for financial transactions, ensuring accurate payment processing.
    -   **Default Company Setting**: You can designate a company as the default. When creating new orders, the default company is automatically selected, streamlining the order creation process and ensuring consistency.

### Order Management

The Order Management module is designed to streamline the process of creating and managing orders, making it efficient and user-friendly. Below are the key features related to managing orders:

-   **Order Creation**: Easily create and manage orders with various options to input products:

    -   **Barcode Scanner**: Quickly add products to an order using a barcode scanner, speeding up the entry process.
    -   **Add by SKU**: Enter the product SKU number manually if a barcode scanner is not available, ensuring flexibility in how products are added.
    -   **Scan with camera**: Scan barcodes using your mobile device's camera, allowing for convenient and efficient product entry directly from your smartphone or tablet.

-   **Discount Management**:
    -   **Apply Discounts**: There is a button to set a discount for every item in the order at once. This feature allows you to apply a uniform discount across all items in the order quickly, simplifying the discount management process and ensuring consistency in pricing.

These features ensure that the order creation process is efficient, flexible, and tailored to your business needs, helping you manage orders smoothly and effectively.

### User Management

The User Management module allows for the creation and management of user accounts with varying levels of access. Below are the key features related to managing users:

-   **User Accounts**: Each user profile includes essential credentials and roles:
    -   **Username**: A unique identifier for each user, used for login and access control.
    -   **Password**: Securely stored password for authentication and account access.
    -   **Role**: Assign roles to users to control their access levels and permissions:
        -   **User**: The basic role with limited access. Users can create products, orders, and customers, but cannot edit or delete existing records.
        -   **Manager**: A role with elevated permissions. Managers can edit all records, including products, orders, and customers, but cannot delete them.
        -   **Admin**: The highest role with full control. Admins can create, edit, and delete any records, including users. Admins have complete access to all features of the application.

This user management system ensures that your application is secure and that access is appropriately controlled according to the user's role, helping to maintain order and data integrity within your business operations.

### WooCommerce Integration

The WooCommerce Integration module ensures seamless synchronization between your web-based application and your WooCommerce store, keeping your product and order data consistent across both platforms. Here are the key features of this integration:

-   **Product and Category Synchronization**:

    -   **Create/Edit/Delete**: Any changes made to products or categories in the application are automatically synchronized with your WooCommerce store. This includes creating new products or categories, editing existing ones, and deleting items. The synchronization ensures that your WooCommerce store reflects the same product and category details as maintained in your application.

-   **Order Synchronization**:

    -   **Order Import**: When a new order is placed on your WooCommerce store, it is automatically sent to the application’s database. This feature allows you to view and manage WooCommerce orders directly within the application, providing a unified view of all orders across both platforms.

-   **Inventory Synchronization**:
    -   **Real-Time Sync**: Product quantities are synchronized between the application and WooCommerce in real-time. This includes updates made during restocking in the application, creating orders in the app, or processing orders in WooCommerce. This ensures that inventory levels are consistent and accurate, reducing the risk of overselling or stock discrepancies.

This integration ensures that your product information, orders, and inventory levels are consistently updated across both your application and WooCommerce store, facilitating smooth and efficient management of your online business operations.

---

## Environment variables

To run this project, you will need to add all of the following environment variables to your .env file
| Variable | Value | Decsription |
| - | - | - |
| `ENV` | "live" or "dev" | Used for Express, MongoDB, logging
| `URL` | string (ex. "https://localhost:3003" or "https://website.com") | URL to the current site, used as path for uploading images. Don't add the trailing slash "/" at the end!
| `MONGO_USER` | string (ex. "user123") | Username for MongoDB connection
| `MONGO_PASSWORD` | string (ex. "veryLongPassword") | Password for MongoDB connection
| `MONGO_URI` | string (ex. mongodb+srv://cluster.server.mongodb.net) | Connection URI for MongoDB
| `JWT_SECRET` | string | Used for user password generation

## WooCommerce environment variables

These variables are **NOT** required to run the app! If you wish your app to synchronize products, categories, attributes and orders to your WooCommerce website, add the below variables to your .env file

| Variable     | Value                            | Decsription                    |
| ------------ | -------------------------------- | ------------------------------ |
| `WOO_URL`    | string (ex. https://website.com) | URL to the WooCommerce website |
| `WOO_KEY`    | string (ex. ck_gh234123...)      | WooCommerce REST API Key       |
| `WOO_SECRET` | string (ex. cs_354123...)        | WooCommerce REST API Secret    |

## WooCommerce Hooks

This is **NOT** required if you are not using the WooCommerce! Setup the following WooCommerce hooks needed for the app to function correctly. Go to WooCommerce > Settings > Advanced > Webhooks and add the following hooks, replacing example.com with your app domain name. For `Secret`, use the `WOO_HOOKS_SECRET` from your `.env` file.

| Topic         | Delivery URL                                       | Notes                                             |
| ------------- | -------------------------------------------------- | ------------------------------------------------- |
| Order created | https://example.com/server/woocommerce/hooks/order | On new order in WooCommerce, create it in the app |

---

## Testing environment variables

To run tests, you will need to add all of the following environment variables to your .env file
| Variable | Value | Decsription |
| - | - | - |
| `MONGO_TEST_USER` | string (ex. "testuser") | Username for MongoDB connection
| `MONGO_TEST_PASSWORD` | string (ex. "testpass") | Password for MongoDB connection
| `WOO_HOOKS_SECRET` | string | Secret used for the WooCommerce hooks requests. Generate by running `node -e "console.log(require('crypto').randomBytes(256).toString('base64'));"` |

---

## Run Locally

You have to have Nginx installed on your system. Instructions on how-to are in `instructions\nginx.txt`

Clone the project in your `nginx\html` directory.

```bash
  git clone https://github.com/NewHappyRabbit/rabb.it
```

Open the folder in terminal.

```bash
  cd rabb.it
```

Install dependencies

```bash
  npm install
```

Create an SSL certificate. Instructions on how-to in `/instructions/ssl.txt`

Start the server

```bash
  npm run server-dev
```

An admin user will be automatically created if no users are found in the database with username: `admin` and password `123456`.

Start webpack

```bash
  npm run web-dev
```

Serve from the `/public` folder with, for example, `Live Server` extension on VSCode.

## Running Tests

To run tests, run the following command

```bash
  npm run test
```

## Deployment

Take a look at the `instructions\nginx.txt` to see how to setup the config and SSL for your domain.

Run webpack in production mode to optimize the output.

```bash
  npm run web-prod
```

---

## Roadmap

Visit our [Trello Board](https://trello.com/b/59GbDQte/rabbit) to check out what's coming up like new features, bug fixes and ideas!

## Tech Stack used

**Client:** 'lit-elements' for super fast and lightweight rendering and the plain old javascript

**Server:** Node, Express

This file was created using the help of this awesome tool called [Readme.SO](https://readme.so/)!
