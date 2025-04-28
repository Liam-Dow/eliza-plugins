import { Service, elizaLogger, IAgentRuntime } from "@ai16z/eliza";
import axios from 'axios';
import type { MarketDatabaseAdapter } from '@ai16z/adapter-marketdatabase';
import { z } from 'zod';
import { 
    MarketData,
    CoinGeckoMarketDataResponseSchema
} from '../types';

const CoinGeckoResponseSchema = z.array(z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    current_price: z.number().nullable(),
    market_cap: z.number().nullable(),
    total_volume: z.number().nullable(),
    market_cap_rank: z.number().nullable(),
    price_change_percentage_1h_in_currency: z.number().nullable(),
    price_change_percentage_24h_in_currency: z.number().nullable(),
    price_change_percentage_7d_in_currency: z.number().nullable(),
    price_change_percentage_14d_in_currency: z.number().nullable(),
    price_change_percentage_30d_in_currency: z.number().nullable(),
}));

export class MarketDataService extends Service {
    static getInstance<T extends MarketDataService>(db: MarketDatabaseAdapter): T {
        return new MarketDataService(db) as T;
    }

    private db: MarketDatabaseAdapter;
    private apiKey: string;
    private updateInterval: NodeJS.Timeout | null = null;
    private isUpdating: boolean = false;
    private lastUpdateTime: number = 0;
    
    private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour
    private readonly MINIMUM_UPDATE_GAP = 55 * 60 * 1000; // 55 minutes
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 5 * 60 * 1000; // 5 minutes
    private readonly API_BASE_URL = 'https://api.coingecko.com/api/v3';

    constructor(db: MarketDatabaseAdapter) {
        super();
        this.db = db;
        this.apiKey = process.env.COINGECKO_API_KEY || '';
        
        if (!this.apiKey) {
            elizaLogger.warn('COINGECKO_API_KEY not found in environment variables');
        }
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        elizaLogger.info('Initializing MarketDataService');
        
        try {
            await this.updateMarketData();
            
            this.updateInterval = setInterval(() => {
                this.checkAndUpdate();
            }, this.UPDATE_INTERVAL);
            
            elizaLogger.info('MarketDataService initialized successfully');
        } catch (error) {
            elizaLogger.error('Failed to initialize MarketDataService:', error);
            throw error;
        }
    }

    private async checkAndUpdate(): Promise<void> {
        if (this.isUpdating) {
            elizaLogger.debug('Update already in progress, skipping');
            return;
        }

        const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
        if (timeSinceLastUpdate < this.MINIMUM_UPDATE_GAP) {
            elizaLogger.debug('Minimum update gap not reached, skipping');
            return;
        }

        try {
            this.isUpdating = true;
            await this.updateMarketData();
        } finally {
            this.isUpdating = false;
        }
    }

    private async updateMarketData(): Promise<void> {
        let retryCount = 0;
        
        while (retryCount < this.MAX_RETRIES) {
            try {
                const [ecosystemData, memeCoinsData] = await Promise.all([
                    this.fetchCategoryData('base-ecosystem'),
                    this.fetchCategoryData('base-meme-coins')
                ]);

                const timestamp = new Date().toISOString();
                const processedData = [
                    ...this.processApiResponse(ecosystemData, 'base-ecosystem', timestamp),
                    ...this.processApiResponse(memeCoinsData, 'base-meme-coins', timestamp)
                ];

                await this.db.storeMarketData(processedData);
                this.lastUpdateTime = Date.now();
                await this.db.cleanOldData(30);
                
                elizaLogger.info('Market data updated successfully', {
                    ecosystemCount: ecosystemData.length,
                    memeCoinsCount: memeCoinsData.length,
                    timestamp
                });
                
                return;
            } catch (error) {
                retryCount++;
                elizaLogger.error(`Market data update failed (attempt ${retryCount}/${this.MAX_RETRIES}):`, error);
                
                if (retryCount < this.MAX_RETRIES) {
                    elizaLogger.info(`Retrying in ${this.RETRY_DELAY / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                } else {
                    throw new Error(`Failed to update market data after ${this.MAX_RETRIES} attempts`);
                }
            }
        }
    }

    private async fetchCategoryData(category: 'base-ecosystem' | 'base-meme-coins'): Promise<z.infer<typeof CoinGeckoResponseSchema>> {
        const url = `${this.API_BASE_URL}/coins/markets`;
        const params = {
            vs_currency: 'usd',
            category,
            order: 'volume_desc',
            per_page: 250,
            price_change_percentage: '1h,24h,7d,14d,30d',
            locale: 'en',
            precision: 'full'
        };

        try {
            const response = await axios.get(url, {
                params,
                headers: {
                    'accept': 'application/json',
                    'x-cg-demo-api-key': this.apiKey
                }
            });

            const validatedData = CoinGeckoResponseSchema.parse(response.data);
            return validatedData;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                elizaLogger.warn('Rate limit reached for CoinGecko API');
                throw new Error('Rate limit reached');
            }
            elizaLogger.error(`Error fetching ${category} data:`, error);
            throw error;
        }
    }

    private processApiResponse(
        data: z.infer<typeof CoinGeckoResponseSchema>,
        category: 'base-ecosystem' | 'base-meme-coins',
        timestamp: string
    ): MarketData[] {
        return data.map(item => ({
            id: item.id,
            symbol: item.symbol,
            name: item.name,
            category,
            current_price: item.current_price || 0,
            market_cap: item.market_cap || 0,
            total_volume: item.total_volume || 0,
            market_cap_rank: item.market_cap_rank,
            price_change_percentage_1h: item.price_change_percentage_1h_in_currency,
            price_change_percentage_24h: item.price_change_percentage_24h_in_currency,
            price_change_percentage_7d: item.price_change_percentage_7d_in_currency,
            price_change_percentage_14d: item.price_change_percentage_14d_in_currency,
            price_change_percentage_30d: item.price_change_percentage_30d_in_currency,
            timestamp
        }));
    }

    async cleanup(): Promise<void> {
        elizaLogger.info('Cleaning up MarketDataService');
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}
