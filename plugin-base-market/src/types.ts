export interface TokenMarketData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number;
    fully_diluted_valuation: number;
    total_volume: number;
    high_24h: number;
    low_24h: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    circulating_supply: number;
    total_supply: number;
    max_supply: number;
    ath: number;
    ath_change_percentage: number;
    ath_date: string;
    atl: number;
    atl_change_percentage: number;
    atl_date: string;
    last_updated: string;
    price_change_percentage_1h_in_currency: number;
    price_change_percentage_24h_in_currency: number;
    price_change_percentage_7d_in_currency: number;
    price_change_percentage_14d_in_currency: number;
    price_change_percentage_30d_in_currency: number;
    price_change_percentage_200d_in_currency: number;
    category: string;
    timestamp: number;
}

export interface MarketDataResponse {
    success: boolean;
    data?: TokenMarketData[];
    error?: string;
}

export interface TokenInfo {
    id: string;
    symbol: string;
    name: string;
    asset_platform_id: string;
    contract_address: string;
    erc20_decimals: number;
    public_notice: string | null;
    additional_notices: string | null;
    description: string | null;
    homepage_url: string | null;
    deployer_basescan_url: string | null;
    token_basescan_url: string | null;
    chat_url: string | null;
    announcement_url: string | null;
    snapshot_url: string | null;
    twitter_url: string | null;
    telegram_url: string | null;
    subreddit_url: string | null;
    github_url: string | null;
    bitbucket_url: string | null;
    image_thumb_url: string | null;
    image_small_url: string | null;
    image_large_url: string | null;
    country_origin: string | null;
    genesis_date: string | null;
    watchlist_portfolio_users: number | null;
    market_cap_rank: number | null;
    twitter_followers: number | null;
    telegram_channel_users: number | null;
}

export interface TokenDexData {
    token_id: string;
    dex_identifier: string;
    base_token_address: string;
    target_token_address: string;
    trust_score: string;
    bid_ask_spread_percentage: number;
    timestamp: string;
    last_traded_at: string;
    last_fetch_at: string;
    is_anomaly: boolean;
    trade_url: string;
    target_token_id: string;
}

export interface TokenInfoResponse {
    success: boolean;
    data?: TokenInfo;
    error?: string;
}
export interface MarketOverview {
    total_tokens: number;
    total_market_cap: number;
    total_volume: number;
    strong_performers_24h: number;
    moderate_performers_24h: number;
    strong_decliners_24h: number;
    strong_performers_7d: number;
    moderate_performers_7d: number;
    strong_decliners_7d: number;
    strong_performers_30d: number;
    moderate_performers_30d: number;
    strong_decliners_30d: number;
    avg_24h_change: number;
    avg_7d_change: number;
    avg_30d_change: number;
}

export interface NotableMover {
    timeframe: string;
    name: string;
    symbol: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    price_change: number;
    movement_type: string;
}
// Database schema types
export interface StoredContractAnalysis {
    contract_address: string;
    last_updated: number;
    goplus_data: string; // JSON stringified GoPlusLabsResponse
    created_at: number;
}
