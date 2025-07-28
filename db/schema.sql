-- Enum types (MySQL supports ENUM inline, no CREATE TYPE needed)

-- Table: accounts
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    avatar_url TEXT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role ENUM('admin', 'staff') DEFAULT 'staff',
    UNIQUE (email),
    INDEX idx_accounts_name (name)
);

-- Table: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(30),
    UNIQUE (email),
    INDEX idx_suppliers_name (name)
);

-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(30),
    UNIQUE (email),
    INDEX idx_customers_name (name)
);

-- Table: categories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- Table: products
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX idx_products_name (name)
);

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    supplier_id INT,
    customer_id INT,
    type ENUM('purchase', 'sale', 'return') NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    deleted_by INT,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (deleted_by) REFERENCES accounts(id) ON DELETE NO ACTION
);


-- Table: transaction_items
CREATE TABLE IF NOT EXISTS transaction_items (
    transaction_id INT NOT NULL,
    product_id INT NOT NULL,
    unit_name VARCHAR(255) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, product_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE NO ACTION
);


-- Table: stock_logs
CREATE TABLE IF NOT EXISTS stock_logs (
    transaction_id INT NOT NULL,
    product_id INT NOT NULL,
    init_stock INT NOT NULL,
    change_type ENUM('in', 'out') NOT NULL,
    quantity INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, product_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE NO ACTION
);

