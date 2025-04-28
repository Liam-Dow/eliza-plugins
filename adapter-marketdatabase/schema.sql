-- Enable foreign key constraints and other SQLite optimizations
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- Create the categories table for flexible token categorization
CREATE TABLE IF NOT EXISTS token_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the coins table to store static coin information
CREATE TABLE IF NOT EXISTS coins (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the coin_categories junction table for flexible categorization
CREATE TABLE IF NOT EXISTS coin_categories (
    coin_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (coin_id, category_id),
    FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES token_categories(id) ON DELETE CASCADE
);

-- Create the market_data table to store time-series price and volume data
CREATE TABLE IF NOT EXISTS market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT NOT NULL,
    current_price REAL NOT NULL,
    market_cap REAL NOT NULL,
    total_volume REAL NOT NULL,
    market_cap_rank INTEGER,
    price_change_percentage_1h REAL,
    price_change_percentage_24h REAL,
    price_change_percentage_7d REAL,
    price_change_percentage_14d REAL,
    price_change_percentage_30d REAL,
    price_change_percentage_200d REAL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_source TEXT NOT NULL DEFAULT 'coingecko',
    FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE
);

-- Create the market_statistics table for caching complex calculations
CREATE TABLE IF NOT EXISTS market_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    calculation_type TEXT NOT NULL,
    value REAL NOT NULL,
    period TEXT NOT NULL,
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES token_categories(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_coin_timestamp ON market_data(coin_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_coin_categories ON coin_categories(coin_id, category_id);
CREATE INDEX IF NOT EXISTS idx_market_data_source ON market_data(data_source, timestamp);

-- Create views for common queries
CREATE VIEW IF NOT EXISTS latest_market_data AS
SELECT 
    c.id,
    c.symbol,
    c.name,
    GROUP_CONCAT(tc.name) as categories,
    md.*
FROM coins c
JOIN market_data md ON c.id = md.coin_id
LEFT JOIN coin_categories cc ON c.id = cc.coin_id
LEFT JOIN token_categories tc ON cc.category_id = tc.id
WHERE md.timestamp = (
    SELECT MAX(timestamp) 
    FROM market_data 
    WHERE coin_id = c.id
)
GROUP BY c.id;