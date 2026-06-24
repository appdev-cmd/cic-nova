-- Create materials table to act as a global catalog
CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'aluminum', 'accessory', 'glass', 'other'
    unit VARCHAR(50) NOT NULL DEFAULT 'pc',
    default_price REAL NOT NULL DEFAULT 0.0,
    weight_per_m REAL NOT NULL DEFAULT 0.0
);
