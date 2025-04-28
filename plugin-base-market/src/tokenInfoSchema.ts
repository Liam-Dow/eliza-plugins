export const tokenInfoSchema = `
CREATE TABLE IF NOT EXISTS base_token_info (
    -- Primary identifier fields
    id TEXT PRIMARY KEY,  -- e.g., "degen-base"
    symbol TEXT,
    name TEXT,
    asset_platform_id TEXT,
    contract_address TEXT,
    erc20_decimals INTEGER,

    -- Notice fields
    public_notice TEXT,
    additional_notices TEXT,
    description TEXT,

    -- URLs and links
    homepage_url TEXT,
    deployer_basescan_url TEXT,
    token_basescan_url TEXT,
    chat_url TEXT,
    announcement_url TEXT,
    snapshot_url TEXT,
    twitter_url TEXT,
    telegram_url TEXT,
    subreddit_url TEXT,
    github_url TEXT,
    bitbucket_url TEXT,

    -- Image URLs
    image_thumb_url TEXT,
    image_small_url TEXT,
    image_large_url TEXT,

    -- Additional metadata
    country_origin TEXT,
    genesis_date TEXT,
    watchlist_portfolio_users INTEGER,
    market_cap_rank INTEGER,
    twitter_followers INTEGER,
    telegram_channel_users INTEGER,

    -- Metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_categories (
    token_id TEXT,
    category TEXT,
    PRIMARY KEY (token_id, category),
    FOREIGN KEY (token_id) REFERENCES base_token_info(id)
);

CREATE TABLE IF NOT EXISTS token_dex_data (
    token_id TEXT,
    dex_identifier TEXT,  -- e.g., "uniswap-v3-base"
    base_token_address TEXT,
    target_token_address TEXT,
    trust_score TEXT,
    bid_ask_spread_percentage REAL,
    timestamp TIMESTAMP,
    last_traded_at TIMESTAMP,
    last_fetch_at TIMESTAMP,
    is_anomaly BOOLEAN,
    trade_url TEXT,
    target_token_id TEXT,
    PRIMARY KEY (token_id, dex_identifier, timestamp),
    FOREIGN KEY (token_id) REFERENCES base_token_info(id)
);`;
