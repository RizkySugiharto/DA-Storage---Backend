-- Insert into accounts
INSERT INTO accounts (avatar_url, name, email, password, role) VALUES
(NULL, 'Admin', 'admin@example.com', '0a4f171c0c4f44258c381ed96d017875a0dc91f2ce711286bb8ad67e2a4b96cd', 'staff'),
(NULL, 'Alice', 'alice@example.com', 'ca035a91045340f3916ece69f547b75c908afd372afc45d65245a9be418a71e1', 'staff'),
(NULL, 'Bob', 'bob@example.com', '0dceb6e451afb0331bc5b193d7dc297e6ddafb6a9dd0c61787f3ef062b978313', 'admin'),
(NULL, 'Charlie', 'charlie@example.com', 'c6430cb66eaeb3f50981c9cbe42a6103a037d421cd137105cce4029d8fb7614a', 'staff'),
(NULL, 'David', 'david@example.com', '718e058246efba1fe72cafd5020e4f51929413fb5cf6b7c03c9a750a3c69866e', 'admin'),
(NULL, 'Eve', 'eve@example.com', '147843eea25c07dcdf68dab21fef274f2cef5ddd9ede64b737e4997c2e0ea9d2', 'staff'),
(NULL, 'Frank', 'frank@example.com', 'fb56ff54e36c01ff6992c8bc9555e40e7b44ec388388707491d7ca9085d0317d', 'admin'),
(NULL, 'Grace', 'grace@example.com', '6bb952d14593b2d419373bcdf259aa3115d0239561a9f43d1479f62a10bdaac4', 'staff'),
(NULL, 'Heidi', 'heidi@example.com', 'b7fbdf5eba423f0b6d343b39df59c3898a42b0913ffa062dc20c2d380da7c646', 'admin'),
(NULL, 'Ivan', 'ivan@example.com', '95391a57141edf9c3ee58b720b8fbe5d80a87c450bcbbf5870e88362b9253d16', 'staff'),
(NULL, 'Judy', 'judy@example.com', '5bc60d09a01b8acf6afcc9d7ef939e7d7741c74bb5d1e7393cafd5ec825594bd', 'admin');

-- Insert into suppliers
INSERT INTO suppliers (name, email, phone_number) VALUES
('Supplier A', 'supplierA@example.com', '+62 123456789'),
('Supplier B', 'supplierB@example.com', '+62 987654321'),
('Supplier C', 'supplierC@example.com', '+62 456789123'),
('Supplier D', 'supplierD@example.com', '+62 321654987'),
('Supplier E', 'supplierE@example.com', '+62 654321789'),
('Supplier F', 'supplierF@example.com', '+62 789123456'),
('Supplier G', 'supplierG@example.com', '+62 159753486'),
('Supplier H', 'supplierH@example.com', '+62 753159486'),
('Supplier I', 'supplierI@example.com', '+62 258963147'),
('Supplier J', 'supplierJ@example.com', '+62 369258147');

-- Insert into customers
INSERT INTO customers (name, email, phone_number) VALUES
('Customer A', 'customerA@example.com', '+62 147258369'),
('Customer B', 'customerB@example.com', '+62 258369147'),
('Customer C', 'customerC@example.com', '+62 369147258'),
('Customer D', 'customerD@example.com', '+62 147369258'),
('Customer E', 'customerE@example.com', '+62 258147369'),
('Customer F', 'customerF@example.com', '+62 369258147'),
('Customer G', 'customerG@example.com', '+62 147258963'),
('Customer H', 'customerH@example.com', '+62 258963147'),
('Customer I', 'customerI@example.com', '+62 369258963'),
('Customer J', 'customerJ@example.com', '+62 147963258');

-- Insert into categories
INSERT INTO categories (name, description) VALUES
('Electronics', 'Devices and gadgets'),
('Groceries', 'Daily food items'),
('Clothing', 'Apparel and accessories'),
('Furniture', 'Home and office furniture'),
('Toys', 'Children’s play items');

-- Insert into products
INSERT INTO products (category_id, name, price, stock, updated_at) VALUES
(1, 'Smartphone', 5000000, 100, '2025-01-01 10:00:00'),
(2, 'Rice', 15000, 200, '2025-01-02 10:00:00'),
(3, 'T-shirt', 75000, 150, '2025-01-03 10:00:00'),
(4, 'Sofa', 2000000, 50, '2025-01-04 10:00:00'),
(5, 'Action Figure', 300000, 80, '2025-01-05 10:00:00');

-- Insert into transactions
INSERT INTO transactions (account_id, supplier_id, customer_id, type, total_cost, created_at) VALUES
(1, 1, 1, 'purchase', 1000000, '2025-01-06 10:00:00'),
(2, 2, 2, 'sale', 2000000, '2025-01-07 10:05:00'),
(3, 3, 3, 'return', 1500000, '2025-01-08 10:10:00'),
(4, 4, 4, 'purchase', 2500000, '2025-01-09 10:15:00'),
(5, 5, 5, 'sale', 3000000, '2025-01-10 10:20:00');

-- Insert into transaction_items
INSERT INTO transaction_items (transaction_id, product_id, unit_name, unit_price, quantity, created_at) VALUES
(1, 1, 'Smartphone', 5000000, 2, '2025-01-06 10:00:00'),
(1, 2, 'Rice', 15000, 5, '2025-01-06 10:00:00'),
(2, 3, 'T-shirt', 75000, 3, '2025-01-07 10:05:00'),
(2, 4, 'Sofa', 2000000, 1, '2025-01-07 10:05:00'),
(3, 5, 'Action Figure', 300000, 4, '2025-01-08 10:10:00'),
(3, 1, 'Smartphone', 5000000, 1, '2025-01-08 10:10:00'),
(4, 2, 'Rice', 15000, 10, '2025-01-09 10:15:00'),
(4, 3, 'T-shirt', 75000, 2, '2025-01-09 10:15:00'),
(5, 4, 'Sofa', 2000000, 1, '2025-01-10 10:20:00'),
(5, 5, 'Action Figure', 300000, 3, '2025-01-10 10:20:00');

-- Insert into stock_logs
INSERT INTO stock_logs (transaction_id, product_id, init_stock, change_type, quantity, created_at) VALUES
(1, 1, 100, 'in', 2, '2025-01-06 10:00:00'),
(1, 2, 200, 'in', 5, '2025-01-06 10:00:00'),
(2, 3, 150, 'out', 3, '2025-01-07 10:05:00'),
(2, 4, 50, 'out', 1, '2025-01-07 10:05:00'),
(3, 5, 80, 'in', 4, '2025-01-08 10:10:00'),
(3, 1, 102, 'in', 1, '2025-01-08 10:10:00'),
(4, 2, 205, 'out', 10, '2025-01-09 10:15:00'),
(4, 3, 147, 'out', 2, '2025-01-09 10:15:00'),
(5, 4, 49, 'in', 1, '2025-01-10 10:20:00'),
(5, 5, 84, 'in', 3, '2025-01-10 10:20:00');