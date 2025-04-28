import { 
    CoinData, 
    TrendingCoin, 
    validateCoinGeckoResponse, 
    SearchResult,
    validateTrendingResults,
    validateSearchResults 
} from '../types';
import axios from 'axios';
import { elizaLogger } from "@ai16z/eliza";

export class CoingeckoService {
    private baseUrl = 'https://api.coingecko.com/api/v3';
    private cache = new Map<string, { data: any; timestamp: number }>();
    private cacheDuration = 5 * 60 * 1000;
    private requestQueue: Promise<any> = Promise.resolve();
    private minRequestInterval = 1000;
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.COINGECKO_API_KEY || '';
        if (!this.apiKey) {
            elizaLogger.warn('COINGECKO_API_KEY not found in environment variables');
        }
    }

    private getHeaders() {
        return {
            'x-cg-demo-api-key': this.apiKey,
            'Accept': 'application/json'
        };
    }

    private async executeWithRateLimit<T>(operation: () => Promise<T>): Promise<T> {
        this.requestQueue = this.requestQueue
            .then(() => operation())
            .then(async (result) => {
                await new Promise(resolve => setTimeout(resolve, this.minRequestInterval));
                return result;
            });
        return this.requestQueue;
    }

    private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && now - cached.timestamp < this.cacheDuration) {
            return cached.data;
        }

        const data = await this.executeWithRateLimit(fetcher);
        this.cache.set(key, { data, timestamp: now });
        return data;
    }

    async getPrice(coinId: string): Promise<CoinData> {
        try {
            return await this.getCached(`price_${coinId}`, async () => {
                const response = await axios.get(`${this.baseUrl}/simple/price`, {
                    headers: this.getHeaders(),
                    params: {
                        ids: coinId,
                        vs_currencies: 'usd',
                        include_market_cap: true,
                        include_24hr_vol: true,
                        include_24hr_change: true,
                        include_last_updated_at: true
                    }
                });
    
                const coinData = response.data[coinId];
                if (!coinData) {
                    throw new Error(`No data found for coin: ${coinId}`);
                }
    
                const formattedData: CoinData = {
                    id: coinId,
                    name: coinId,
                    symbol: coinId,
                    current_price: coinData.usd,
                    market_cap: coinData.usd_market_cap,
                    total_volume: coinData.usd_24h_vol,
                    price_change_percentage_24h: coinData.usd_24h_change,
                    last_updated: new Date(coinData.last_updated_at * 1000).toISOString()
                };
    
                return validateCoinGeckoResponse(formattedData);
            });
        } catch (error) {
            elizaLogger.error('Error fetching price from Coingecko:', 
                error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    async getTrending(): Promise<TrendingCoin[]> {
        try {
            return await this.getCached('trending', async () => {
                const response = await axios.get(`${this.baseUrl}/search/trending`, {
                    headers: this.getHeaders()
                });
                
                if (!response.data?.coins) {
                    throw new Error('Unexpected API response format: missing coins array');
                }
                
                return validateTrendingResults(response.data.coins);
            });
        } catch (error) {
            elizaLogger.error('Error fetching trending from Coingecko:', error);
            throw error;
        }
    }
    
    async searchCoins(query: string): Promise<SearchResult[]> {
        try {
            elizaLogger.debug('Searching coins with query:', query);
            return await this.getCached(`search_${query}`, async () => {
                const response = await axios.get(`${this.baseUrl}/search`, {
                    headers: this.getHeaders(),
                    params: { query }
                });
                
                elizaLogger.debug('Search response data:', response.data);
                
                if (!response.data?.coins) {
                    throw new Error('Unexpected API response format: missing coins array');
                }
                
                return validateSearchResults(response.data.coins);
            });
        } catch (error) {
            elizaLogger.error('Error searching coins on Coingecko:', error);
            throw error;
        }
    }
}
