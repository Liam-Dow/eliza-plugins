import { Service, ServiceType, elizaLogger, IAgentRuntime } from "@ai16z/eliza";
import type { Database } from "better-sqlite3";
import axios from "axios";
import { tokenInfoSchema } from "../tokenInfoSchema";
import { TokenInfo, TokenInfoResponse, TokenDexData } from "../types";
import { MarketDataService } from "./marketDataService";

export class TokenInfoService extends Service {
    static serviceType = ServiceType.BASE_TOKEN_INFO;
    private db: Database;
    private apiKey: string | null = null;
    private readonly RATE_LIMIT = 30;
    private readonly DELAY_BETWEEN_REQUESTS = (60 * 1000) / this.RATE_LIMIT;
    private requestQueue: string[] = [];

    constructor(db: Database) {
        super();
        this.db = db;
        elizaLogger.info("TokenInfoService constructed with database instance");
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        try {
            elizaLogger.info("Starting TokenInfoService initialization...");

            const statements = tokenInfoSchema
                .split(";")
                .filter((stmt) => stmt.trim());
            for (const statement of statements) {
                if (statement.trim()) {
                    this.db.prepare(statement + ";").run();
                }
            }
            elizaLogger.info("Token info tables created successfully");

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

            elizaLogger.info(
                "Waiting for MarketDataService to complete initial data fetch..."
            );

            const marketDataService = runtime.getService<MarketDataService>(
                ServiceType.BASE_MARKET_DATA
            );

            if (!marketDataService) {
                throw new Error("MarketDataService not available");
            }

            let hasMarketData = false;
            let attempts = 0;
            const maxAttempts = 24;

            while (!hasMarketData && attempts < maxAttempts) {
                const tokenIds = await marketDataService.getAllTokenIds();
                if (tokenIds.length > 0) {
                    hasMarketData = true;
                    elizaLogger.info(
                        `MarketDataService has completed initial fetch with ${tokenIds.length} tokens`
                    );
                } else {
                    elizaLogger.info(
                        "Waiting for MarketDataService to complete initial fetch..."
                    );
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    attempts++;
                }
            }

            if (!hasMarketData) {
                throw new Error(
                    "Timeout waiting for MarketDataService to complete initial fetch"
                );
            }

            const tokensToProcess = await this.getTokensNeedingInfo(runtime);

            if (tokensToProcess.length > 0) {
                elizaLogger.info(
                    `Found ${tokensToProcess.length} tokens that need info processing`
                );
                await this.processBulkTokenInfo(tokensToProcess);
            } else {
                elizaLogger.info("No new tokens need processing");
            }

            elizaLogger.success(
                "TokenInfoService initialization completed successfully"
            );
        } catch (error) {
            elizaLogger.error(
                "Error in TokenInfoService initialization:",
                error
            );
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        elizaLogger.info("Cleaning up TokenInfoService...");
        this.requestQueue = [];
    }

    private async getTokensNeedingInfo(
        runtime: IAgentRuntime
    ): Promise<string[]> {
        try {
            const marketDataService = runtime.getService<MarketDataService>(
                ServiceType.BASE_MARKET_DATA
            );

            if (!marketDataService) {
                elizaLogger.error("Market data service not available");
                return [];
            }

            const allTokenIds = await marketDataService.getAllTokenIds();

            const existingTokens = this.db
                .prepare("SELECT id FROM base_token_info")
                .all()
                .map((row: any) => row.id);

            const existingTokensSet = new Set(existingTokens);
            const tokensNeedingInfo = allTokenIds.filter(
                (id) => !existingTokensSet.has(id)
            );

            elizaLogger.info(
                `Found ${allTokenIds.length} total tokens, ${tokensNeedingInfo.length} need processing`
            );

            return tokensNeedingInfo;
        } catch (error) {
            elizaLogger.error("Error determining tokens needing info:", error);
            return [];
        }
    }

    private getApiKey(): string {
        if (!this.apiKey) {
            throw new Error("API key not initialized");
        }
        return this.apiKey;
    }

    private async rateLimit(): Promise<void> {
        await new Promise((resolve) =>
            setTimeout(resolve, this.DELAY_BETWEEN_REQUESTS)
        );
    }

    private async handleRateLimit(tokenId: string): Promise<void> {
        const backoffTime = 60000;
        elizaLogger.warn(
            `Rate limit hit for ${tokenId}, waiting ${backoffTime / 1000} seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        this.requestQueue.unshift(tokenId);
    }

    async processBulkTokenInfo(tokenIds: string[]): Promise<void> {
        if (!tokenIds || tokenIds.length === 0) {
            elizaLogger.info("No tokens to process");
            return;
        }

        elizaLogger.info(
            `Starting bulk token info processing for ${tokenIds.length} tokens`
        );
        this.requestQueue = [...tokenIds];

        let successCount = 0;
        let failureCount = 0;
        const failedTokenIds: string[] = [];

        while (this.requestQueue.length > 0) {
            const tokenId = this.requestQueue.shift();
            if (!tokenId) continue;

            try {
                elizaLogger.info(
                    `Processing token ${successCount + failureCount + 1}/${tokenIds.length}: ${tokenId}`
                );
                await this.rateLimit();
                const result = await this.fetchTokenInfo(tokenId);

                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                    failedTokenIds.push(tokenId);
                    elizaLogger.error(
                        `Failed to fetch token info for ${tokenId}: ${result.error}`
                    );
                }
            } catch (error) {
                failureCount++;
                failedTokenIds.push(tokenId);
                elizaLogger.error(`Error processing token ${tokenId}:`, error);
            }

            if ((successCount + failureCount) % 10 === 0) {
                elizaLogger.info(
                    `Progress: ${successCount + failureCount}/${tokenIds.length} tokens processed`
                );
                elizaLogger.info(
                    `Success: ${successCount}, Failures: ${failureCount}`
                );
            }
        }

        elizaLogger.success(
            `Bulk processing completed. Total: ${tokenIds.length}, Success: ${successCount}, Failures: ${failureCount}`
        );

        if (failedTokenIds.length > 0) {
            elizaLogger.info(`Failed token IDs: ${failedTokenIds.join(", ")}`);
        }
    }

    async retryFailedTokens(failedTokenIds: string[]): Promise<void> {
        elizaLogger.info(`Retrying ${failedTokenIds.length} failed tokens`);
        await this.processBulkTokenInfo(failedTokenIds);
    }

    async fetchTokenInfo(tokenId: string): Promise<TokenInfoResponse> {
        elizaLogger.info(`Starting fetchTokenInfo for token: ${tokenId}`);

        try {
            elizaLogger.debug(
                `Making API request to CoinGecko for token: ${tokenId}`
            );

            const response = await axios.get(
                `https://api.coingecko.com/api/v3/coins/${tokenId}`,
                {
                    params: {
                        localization: false,
                        tickers: true,
                        market_data: false,
                        sparkline: true,
                    },
                    headers: {
                        accept: "application/json",
                        "x-cg-demo-api-key": this.getApiKey(),
                    },
                }
            );

            elizaLogger.debug(`Response status: ${response.status}`);

            if (!response.data) {
                elizaLogger.error(
                    `Invalid response data format:`,
                    response.data
                );
                return { success: false, error: "Invalid response format" };
            }

            try {
                this.db.transaction(() => {
                    this.insertTokenInfo(response.data);
                    this.insertCategories(
                        response.data.id,
                        response.data.categories
                    );
                    this.insertDexData(response.data);
                })();

                elizaLogger.success(
                    `Successfully processed token info for ${tokenId}`
                );
                return { success: true, data: response.data };
            } catch (dbError) {
                elizaLogger.error(
                    `Database error while storing token info:`,
                    dbError
                );
                return {
                    success: false,
                    error: `Database error: ${dbError.message}`,
                };
            }
        } catch (error) {
            if (error.response?.status === 429) {
                await this.handleRateLimit(tokenId);
                return { success: false, error: "Rate limit hit, will retry" };
            }

            elizaLogger.error(`Error in fetchTokenInfo:`, {
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

    private insertTokenInfo(data: any): void {
        elizaLogger.debug(`Processing token info for insertion: ${data.id}`);

        const baseContractAddress = data.platforms?.base || null;
        const baseDecimals = data.detail_platforms?.base?.decimal_place || null;

        const homepageUrl = Array.isArray(data.links?.homepage)
            ? data.links.homepage[0] || null
            : null;

        const basescanUrls = (data.links?.blockchain_site || [])
            .filter(
                (url: string | null) =>
                    url &&
                    typeof url === "string" &&
                    url.includes("basescan.org")
            )
            .reduce(
                (
                    acc: { deployer: string | null; token: string | null },
                    url: string
                ) => {
                    if (url.includes("/address/")) {
                        acc.deployer = url;
                    } else if (url.includes("/token/")) {
                        acc.token = url;
                    }
                    return acc;
                },
                { deployer: null, token: null }
            );

        const twitterUrl = data.links?.twitter_screen_name
            ? `https://twitter.com/${data.links.twitter_screen_name}`
            : null;

        const telegramUrl = data.links?.telegram_channel_identifier
            ? `https://t.me/${data.links.telegram_channel_identifier}`
            : null;

        const subredditUrl =
            data.links?.subreddit_url !== "https://www.reddit.com"
                ? data.links?.subreddit_url || null
                : null;

        const githubUrl = data.links?.repos_url?.github?.[0] || null;
        const bitbucketUrl = data.links?.repos_url?.bitbucket?.[0] || null;

        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO base_token_info (
                    id, symbol, name, asset_platform_id, contract_address, erc20_decimals,
                    public_notice, additional_notices, description,
                    homepage_url, deployer_basescan_url, token_basescan_url,
                    chat_url, announcement_url, snapshot_url, twitter_url,
                    telegram_url, subreddit_url, github_url, bitbucket_url,
                    image_thumb_url, image_small_url, image_large_url,
                    country_origin, genesis_date, watchlist_portfolio_users,
                    market_cap_rank, twitter_followers, telegram_channel_users
                ) VALUES (
                    @id, @symbol, @name, @asset_platform_id, @contract_address, @erc20_decimals,
                    @public_notice, @additional_notices, @description,
                    @homepage_url, @deployer_basescan_url, @token_basescan_url,
                    @chat_url, @announcement_url, @snapshot_url, @twitter_url,
                    @telegram_url, @subreddit_url, @github_url, @bitbucket_url,
                    @image_thumb_url, @image_small_url, @image_large_url,
                    @country_origin, @genesis_date, @watchlist_portfolio_users,
                    @market_cap_rank, @twitter_followers, @telegram_channel_users
                )
            `);

            stmt.run({
                id: data.id,
                symbol: data.symbol,
                name: data.name,
                asset_platform_id: data.asset_platform_id,
                contract_address: baseContractAddress,
                erc20_decimals: baseDecimals,
                public_notice: data.public_notice || null,
                additional_notices: JSON.stringify(
                    data.additional_notices || []
                ),
                description: data.description?.en || null,
                homepage_url: homepageUrl,
                deployer_basescan_url: basescanUrls.deployer,
                token_basescan_url: basescanUrls.token,
                chat_url: Array.isArray(data.links?.chat_url)
                    ? data.links.chat_url[0] || null
                    : null,
                announcement_url: Array.isArray(data.links?.announcement_url)
                    ? data.links.announcement_url[0] || null
                    : null,
                snapshot_url: data.links?.snapshot_url || null,
                twitter_url: twitterUrl,
                telegram_url: telegramUrl,
                subreddit_url: subredditUrl,
                github_url: githubUrl,
                bitbucket_url: bitbucketUrl,
                image_thumb_url: data.image?.thumb || null,
                image_small_url: data.image?.small || null,
                image_large_url: data.image?.large || null,
                country_origin: data.country_origin || null,
                genesis_date: data.genesis_date || null,
                watchlist_portfolio_users:
                    data.watchlist_portfolio_users || null,
                market_cap_rank: data.market_cap_rank || null,
                twitter_followers:
                    data.community_data?.twitter_followers || null,
                telegram_channel_users:
                    data.community_data?.telegram_channel_user_count || null,
            });
            elizaLogger.debug(
                `Successfully inserted token info for: ${data.id}`
            );
        } catch (error) {
            elizaLogger.error(`Error inserting token info for ${data.id}:`, {
                error: error.message,
                data: JSON.stringify(data, null, 2),
            });
            throw error;
        }
    }

    private insertCategories(
        tokenId: string,
        categories: string[] | null
    ): void {
        if (!categories || !Array.isArray(categories)) {
            elizaLogger.debug(`No categories to insert for token ${tokenId}`);
            return;
        }

        elizaLogger.debug(
            `Inserting categories for token ${tokenId}: ${categories.length} categories`
        );

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO token_categories (token_id, category)
            VALUES (?, ?)
        `);

        try {
            categories.forEach((category) => {
                if (category && typeof category === "string") {
                    stmt.run(tokenId, category);
                }
            });
            elizaLogger.debug(
                `Successfully inserted categories for token: ${tokenId}`
            );
        } catch (error) {
            elizaLogger.error(`Error inserting categories:`, {
                tokenId,
                categories,
                error: error.message,
            });
            throw error;
        }
    }

    private insertDexData(data: any): void {
        elizaLogger.debug(`Processing DEX data for token: ${data.id}`);

        const validDexIdentifiers = [
            "uniswap-v3-base",
            "uniswap-v4-base",
            "uniswap-v2-base",
            "aerodrome-base",
        ];

        if (!data.tickers || !Array.isArray(data.tickers)) {
            elizaLogger.debug(`No tickers found for token: ${data.id}`);
            return;
        }

        const validTickers = data.tickers.filter(
            (ticker: any) =>
                ticker &&
                ticker.market?.identifier &&
                validDexIdentifiers.includes(ticker.market.identifier) &&
                ticker.trust_score !== "red" &&
                !ticker.is_stale
        );

        elizaLogger.debug(
            `Found ${validTickers.length} valid DEX tickers for token: ${data.id}`
        );

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO token_dex_data (
                token_id, dex_identifier, base_token_address, target_token_address,
                trust_score, bid_ask_spread_percentage, timestamp, last_traded_at,
                last_fetch_at, is_anomaly, trade_url, target_token_id
            ) VALUES (
                @token_id, @dex_identifier, @base_token_address, @target_token_address,
                @trust_score, @bid_ask_spread_percentage, @timestamp, @last_traded_at,
                @last_fetch_at, @is_anomaly, @trade_url, @target_token_id
            )
        `);

        try {
            validTickers.forEach((ticker: any) => {
                stmt.run({
                    token_id: data.id,
                    dex_identifier: ticker.market.identifier,
                    base_token_address: ticker.base || null,
                    target_token_address: ticker.target || null,
                    trust_score: ticker.trust_score || null,
                    bid_ask_spread_percentage:
                        ticker.bid_ask_spread_percentage || null,
                    timestamp: ticker.timestamp || null,
                    last_traded_at: ticker.last_traded_at || null,
                    last_fetch_at: ticker.last_fetch_at || null,
                    is_anomaly: ticker.is_anomaly ? 1 : 0,
                    trade_url: ticker.trade_url || null,
                    target_token_id: ticker.target_coin_id || null,
                });
            });
            elizaLogger.debug(
                `Successfully inserted DEX data for token: ${data.id}`
            );
        } catch (error) {
            elizaLogger.error(`Error inserting DEX data:`, {
                tokenId: data.id,
                error: error.message,
                tickers: validTickers,
            });
            throw error;
        }
    }
}
