import { Service, ServiceType, elizaLogger, IAgentRuntime } from "@ai16z/eliza";
import type { Database } from "better-sqlite3";
import axios from "axios";
import {
    MarketDataResponse,
    TokenMarketData,
    MarketOverview,
    NotableMover,
} from "../types";
import { marketDataSchema } from "../schema";

export class MarketDataService extends Service {
    static serviceType = ServiceType.BASE_MARKET_DATA;
    private db: Database;
    private apiKey: string | null = null;
    private dataCollectionInterval: NodeJS.Timer | null = null;

    constructor(db: Database) {
        super();
        this.db = db;
        elizaLogger.info(
            "MarketDataService constructed with database instance"
        );
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        try {
            elizaLogger.info("Starting MarketDataService initialization...");

            // Create the table using prepare and run
            const createTableStmt = this.db.prepare(marketDataSchema);
            createTableStmt.run();
            elizaLogger.info("Market data table created successfully");

            // Validate and store API key
            const apiKey = process.env.COINGECKO_API_KEY;
            if (!apiKey) {
                elizaLogger.error(
                    "COINGECKO_API_KEY not found in environment variables"
                );
                throw new Error(
                    "COINGECKO_API_KEY not found in environment variables"
                );
            }
            this.apiKey = apiKey;
            elizaLogger.info("CoinGecko API key validated");

            // Do initial data fetch
            elizaLogger.info("Performing initial market data fetch...");
            try {
                await this.fetchMarketData("base-meme-coins");
                await this.fetchMarketData("base-ecosystem");
                elizaLogger.info(
                    "Initial market data fetch completed successfully"
                );
            } catch (error) {
                elizaLogger.error("Error in initial market data fetch:", error);
            }

            // Start data collection interval
            this.dataCollectionInterval = setInterval(
                async () => {
                    elizaLogger.info(
                        "Running scheduled market data collection..."
                    );
                    try {
                        await this.fetchMarketData("base-meme-coins");
                        await this.fetchMarketData("base-ecosystem");
                        elizaLogger.info(
                            "Scheduled market data collection completed"
                        );
                    } catch (error) {
                        elizaLogger.error(
                            "Error in market data collection:",
                            error
                        );
                    }
                },
                60 * 60 * 1000 // 1 hour
            );

            elizaLogger.success(
                "MarketDataService initialization completed successfully"
            );
        } catch (error) {
            elizaLogger.error(
                "Error in MarketDataService initialization:",
                error
            );
            throw error;
        }
    }

    private getApiKey(): string {
        if (!this.apiKey) {
            throw new Error("API key not initialized");
        }
        return this.apiKey;
    }

    async fetchMarketData(category: string): Promise<MarketDataResponse> {
        elizaLogger.info(`Starting fetchMarketData for category: ${category}`);

        const allTokens: any[] = [];
        let currentPage = 1;
        let hasMoreData = true;

        try {
            while (hasMoreData) {
                elizaLogger.debug(
                    `Making API request to CoinGecko for category: ${category}, page: ${currentPage}`
                );

                const requestParams = {
                    vs_currency: "usd",
                    category,
                    order: "id_desc",
                    per_page: 250,
                    page: currentPage,
                    price_change_percentage: "1h,24h,7d,14d,30d,200d",
                    locale: "en",
                    precision: "full",
                };

                elizaLogger.debug(`Request parameters:`, requestParams);

                const response = await axios.get(
                    `https://api.coingecko.com/api/v3/coins/markets`,
                    {
                        params: requestParams,
                        headers: {
                            accept: "application/json",
                            "x-cg-demo-api-key": this.getApiKey(),
                        },
                    }
                );

                elizaLogger.debug(`Response status: ${response.status}`);
                elizaLogger.debug(
                    `Response data length: ${response.data?.length || 0}`
                );

                if (!response.data || !Array.isArray(response.data)) {
                    elizaLogger.error(
                        `Invalid response data format:`,
                        response.data
                    );
                    return { success: false, error: "Invalid response format" };
                }

                allTokens.push(...response.data);

                // If we get fewer results than the page size, we've reached the end
                if (response.data.length < 250) {
                    hasMoreData = false;
                } else {
                    currentPage++;
                    // Small delay to prevent rate limiting on Coingeckos free plan
                    await new Promise((resolve) => setTimeout(resolve, 1100)); // 1.1s delay between requests, worked fine for me but adjust if needed
                }
            }

            elizaLogger.info(
                `Total tokens fetched for ${category}: ${allTokens.length}`
            );

            const timestamp = Math.floor(Date.now() / 1000);
            const data = allTokens.map((token: any) => ({
                ...token,
                category,
                timestamp,
            }));

            try {
                await this.storeMarketData(data);
                elizaLogger.success(
                    `Successfully stored ${data.length} tokens for category ${category}`
                );
                return { success: true, data };
            } catch (dbError) {
                elizaLogger.error(
                    `Database error while storing market data:`,
                    dbError
                );
                return {
                    success: false,
                    error: `Database error: ${dbError.message}`,
                };
            }
        } catch (error) {
            elizaLogger.error(`Error in fetchMarketData:`, {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseData: error.response?.data,
            });

            if (error.response) {
                elizaLogger.error(`API Error Details:`, {
                    status: error.response.status,
                    headers: error.response.headers,
                    data: error.response.data,
                });
            }

            return { success: false, error: error.message };
        }
    }

    private async storeMarketData(data: TokenMarketData[]): Promise<void> {
        elizaLogger.info(`Starting storeMarketData with ${data.length} tokens`);

        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO base_market_data (
                id, symbol, name, image, current_price, market_cap,
                market_cap_rank, fully_diluted_valuation, total_volume,
                high_24h, low_24h, price_change_24h, price_change_percentage_24h,
                market_cap_change_24h, market_cap_change_percentage_24h,
                circulating_supply, total_supply, max_supply, ath,
                ath_change_percentage, ath_date, atl, atl_change_percentage,
                atl_date, last_updated, price_change_percentage_1h_in_currency,
                price_change_percentage_24h_in_currency, price_change_percentage_7d_in_currency,
                price_change_percentage_14d_in_currency, price_change_percentage_30d_in_currency,
                price_change_percentage_200d_in_currency, category, timestamp
            ) VALUES (
                @id, @symbol, @name, @image, @current_price, @market_cap,
                @market_cap_rank, @fully_diluted_valuation, @total_volume,
                @high_24h, @low_24h, @price_change_24h, @price_change_percentage_24h,
                @market_cap_change_24h, @market_cap_change_percentage_24h,
                @circulating_supply, @total_supply, @max_supply, @ath,
                @ath_change_percentage, @ath_date, @atl, @atl_change_percentage,
                @atl_date, @last_updated, @price_change_percentage_1h_in_currency,
                @price_change_percentage_24h_in_currency, @price_change_percentage_7d_in_currency,
                @price_change_percentage_14d_in_currency, @price_change_percentage_30d_in_currency,
                @price_change_percentage_200d_in_currency, @category, @timestamp
            )
        `);

        elizaLogger.debug(`Prepared SQL statement for insertion`);

        const transaction = this.db.transaction((tokens: TokenMarketData[]) => {
            elizaLogger.debug(
                `Starting transaction for ${tokens.length} tokens`
            );

            for (const token of tokens) {
                try {
                    stmt.run(token);
                } catch (error) {
                    elizaLogger.error(`Error inserting token:`, {
                        tokenId: token.id,
                        error: error.message,
                        tokenData: token,
                    });
                    throw error;
                }
            }
        });

        try {
            transaction(data);
            elizaLogger.success(`Successfully completed database transaction`);
        } catch (error) {
            elizaLogger.error(`Transaction failed:`, {
                error: error.message,
                code: error.code,
                stack: error.stack,
            });
            throw error;
        }
    }

    private formatTokenList(tokens: TokenMarketData[]): string {
        return tokens
            .map(
                (token) =>
                    `${token.name} (${token.symbol.toUpperCase()}): ${token.price_change_percentage_24h.toFixed(2)}%`
            )
            .join("\n");
    }

    async getMarketInsights(): Promise<string> {
        try {
            const latestData = this.db
                .prepare(
                    `
                    SELECT * FROM base_market_data
                    WHERE timestamp = (
                        SELECT MAX(timestamp) FROM base_market_data
                    )
                    ORDER BY market_cap DESC
                `
                )
                .all() as TokenMarketData[];

            if (!latestData || latestData.length === 0) {
                return "No market data available yet.";
            }

            const topGainers = latestData
                .filter((token) => token.price_change_percentage_24h > 0)
                .sort(
                    (a, b) =>
                        b.price_change_percentage_24h -
                        a.price_change_percentage_24h
                )
                .slice(0, 5);

            const topLosers = latestData
                .filter((token) => token.price_change_percentage_24h < 0)
                .sort(
                    (a, b) =>
                        a.price_change_percentage_24h -
                        b.price_change_percentage_24h
                )
                .slice(0, 5);

            return `
    Top Gainers (24h):
    ${this.formatTokenList(topGainers)}

    Top Losers (24h):
    ${this.formatTokenList(topLosers)}

    Total tokens tracked: ${latestData.length}
            `.trim();
        } catch (error) {
            elizaLogger.error("Error getting market insights:", error);
            throw error;
        }
    }
    async getAllTokenIds(): Promise<string[]> {
        try {
            const tokenIds = this.db
                .prepare(
                    `
                    SELECT DISTINCT id
                    FROM base_market_data
                    WHERE timestamp = (
                        SELECT MAX(timestamp)
                        FROM base_market_data
                    )
                `
                )
                .all()
                .map((row: any) => row.id);

            elizaLogger.info(
                `Found ${tokenIds.length} unique token IDs in market data`
            );
            return tokenIds;
        } catch (error) {
            elizaLogger.error("Error getting token IDs:", error);
            throw error;
        }
    }
    async getMarketOverview(): Promise<MarketOverview> {
        const overviewQuery = `
            WITH base_native_tokens AS (
                SELECT bmd.*
                FROM base_market_data bmd
                JOIN base_token_info bti ON bmd.id = bti.id
                WHERE bti.asset_platform_id = 'base'
                AND bmd.timestamp = (SELECT MAX(timestamp) FROM base_market_data)
            ),
            top_100_tokens AS (
                SELECT *
                FROM base_native_tokens
                ORDER BY market_cap DESC
                LIMIT 100
            )
            SELECT
                COUNT(*) as total_tokens,
                COALESCE(SUM(market_cap), 0) as total_market_cap,
                COALESCE(SUM(total_volume), 0) as total_volume,
                COUNT(CASE WHEN price_change_percentage_24h > 10 THEN 1 END) as strong_performers_24h,
                COUNT(CASE WHEN price_change_percentage_24h > 5 AND price_change_percentage_24h <= 10 THEN 1 END) as moderate_performers_24h,
                COUNT(CASE WHEN price_change_percentage_24h < -10 THEN 1 END) as strong_decliners_24h,
                COUNT(CASE WHEN price_change_percentage_7d_in_currency > 10 THEN 1 END) as strong_performers_7d,
                COUNT(CASE WHEN price_change_percentage_7d_in_currency > 5 AND price_change_percentage_7d_in_currency <= 10 THEN 1 END) as moderate_performers_7d,
                COUNT(CASE WHEN price_change_percentage_7d_in_currency < -10 THEN 1 END) as strong_decliners_7d,
                COUNT(CASE WHEN price_change_percentage_30d_in_currency > 10 THEN 1 END) as strong_performers_30d,
                COUNT(CASE WHEN price_change_percentage_30d_in_currency > 5 AND price_change_percentage_30d_in_currency <= 10 THEN 1 END) as moderate_performers_30d,
                COUNT(CASE WHEN price_change_percentage_30d_in_currency < -10 THEN 1 END) as strong_decliners_30d,
                COALESCE(AVG(price_change_percentage_24h), 0) as avg_24h_change,
                COALESCE(AVG(price_change_percentage_7d_in_currency), 0) as avg_7d_change,
                COALESCE(AVG(price_change_percentage_30d_in_currency), 0) as avg_30d_change
            FROM top_100_tokens;
        `;

        try {
            const result = this.db
                .prepare(overviewQuery)
                .get() as MarketOverview;
            elizaLogger.debug(
                `Market overview data retrieved: ${result.total_tokens} tokens found`
            );
            return result;
        } catch (error) {
            elizaLogger.error("Error getting market overview:", error);
            throw error;
        }
    }

    async getNotableMovers(): Promise<NotableMover[]> {
        const moversQuery = `
            WITH base_native_metrics AS (
                SELECT
                    bmd.id,
                    bti.name,
                    bti.symbol,
                    bmd.current_price,
                    bmd.market_cap,
                    bmd.total_volume,
                    bmd.price_change_percentage_24h,
                    bmd.price_change_percentage_7d_in_currency as price_change_percentage_7d,
                    (bmd.price_change_percentage_24h *
                     LOG10(CASE WHEN bmd.market_cap > 1 THEN bmd.market_cap ELSE 1 END) *
                     LOG10(CASE WHEN bmd.total_volume > 1 THEN bmd.total_volume ELSE 1 END)) as movement_score_24h,
                    (bmd.price_change_percentage_7d_in_currency *
                     LOG10(CASE WHEN bmd.market_cap > 1 THEN bmd.market_cap ELSE 1 END) *
                     LOG10(CASE WHEN bmd.total_volume > 1 THEN bmd.total_volume ELSE 1 END)) as movement_score_7d
                FROM base_market_data bmd
                JOIN base_token_info bti ON bmd.id = bti.id
                WHERE bmd.timestamp = (SELECT MAX(timestamp) FROM base_market_data)
                AND bti.asset_platform_id = 'base'
                AND bmd.market_cap >= 5000000  -- $5M minimum market cap
                AND bmd.total_volume >= 300000  -- $300k minimum volume
                AND (ABS(bmd.price_change_percentage_24h) >= 5 OR ABS(bmd.price_change_percentage_7d_in_currency) >= 5)
            )
            SELECT
                timeframe,
                name,
                symbol,
                current_price,
                market_cap,
                total_volume,
                price_change,
                movement_type
            FROM (
                -- 24h movers (top 3)
                SELECT *, 'last_24h' as timeframe,
                    price_change_percentage_24h as price_change,
                    CASE WHEN price_change_percentage_24h > 0 THEN 'gainer' ELSE 'loser' END as movement_type,
                    ROW_NUMBER() OVER (
                        PARTITION BY CASE WHEN price_change_percentage_24h > 0 THEN 'gainer' ELSE 'loser' END
                        ORDER BY ABS(movement_score_24h) DESC
                    ) as rank
                FROM base_native_metrics
                WHERE ABS(price_change_percentage_24h) >= 5
                UNION ALL
                -- 7d movers (top 1)
                SELECT *, 'last_7d' as timeframe,
                    price_change_percentage_7d as price_change,
                    CASE WHEN price_change_percentage_7d > 0 THEN 'gainer' ELSE 'loser' END as movement_type,
                    ROW_NUMBER() OVER (
                        PARTITION BY CASE WHEN price_change_percentage_7d > 0 THEN 'gainer' ELSE 'loser' END
                        ORDER BY ABS(movement_score_7d) DESC
                    ) as rank
                FROM base_native_metrics
                WHERE ABS(price_change_percentage_7d) >= 5
            ) ranked
            WHERE (timeframe = 'last_24h' AND rank <= 3)
               OR (timeframe = 'last_7d' AND rank = 1)
            ORDER BY timeframe, movement_type, rank;
        `;

        try {
            const result = this.db.prepare(moversQuery).all() as NotableMover[];
            elizaLogger.debug(`Notable movers found: ${result.length}`);
            return result;
        } catch (error) {
            elizaLogger.error("Error getting notable movers:", error);
            throw error;
        }
    }
}
