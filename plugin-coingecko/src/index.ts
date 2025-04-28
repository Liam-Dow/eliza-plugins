import { Plugin, elizaLogger } from "@ai16z/eliza";
import { MarketDatabaseAdapter } from "@ai16z/adapter-marketdatabase";
import { MarketDataService } from "./services/marketDataService";
import path from "path";

import { getPriceAction } from './actions/getPriceAction';
import { getTrendingAction } from './actions/getTrendingAction';
import { cryptoProvider } from './providers/cryptoProvider';
import { CoingeckoService } from './services/coingeckoService';

export * from './types';

let dbAdapter: MarketDatabaseAdapter | null = null;
let marketService: MarketDataService | null = null;

export const coingeckoPlugin: Plugin = {
    name: "coingecko",
    description: "Enables cryptocurrency price checking and trend analysis using the CoinGecko API",
    
    actions: [
        getPriceAction,
        getTrendingAction
    ],
    
    providers: [
        cryptoProvider
    ],
    
    evaluators: [],

    services: [MarketDataService],

    async initialize(runtime: any) {
        try {
            const dbPath = process.env.MARKET_DB_PATH || 
                          path.join(process.cwd(), 'data', 'market.db');
            
            await runtime.ensureDir(path.dirname(dbPath));
            
            dbAdapter = new MarketDatabaseAdapter(dbPath, {
                failureThreshold: 3,
                resetTimeout: 60000,
                halfOpenMaxAttempts: 2
            });
            await dbAdapter.init();
            
            marketService = new MarketDataService(dbAdapter);
            await marketService.initialize();
            
            elizaLogger.info('CoinGecko plugin market data components initialized');
        } catch (error) {
            elizaLogger.error('Failed to initialize market data components:', error);
            throw error;
        }
    },

    async cleanup() {
        try {
            if (marketService) {
                await marketService.cleanup();
                marketService = null;
            }
            
            if (dbAdapter) {
                await dbAdapter.close();
                dbAdapter = null;
            }
            
            elizaLogger.info('CoinGecko plugin market data components cleaned up');
        } catch (error) {
            elizaLogger.error('Error cleaning up market data components:', error);
            throw error;
        }
    },
};

export { CoingeckoService } from './services/coingeckoService';
export { MarketDataService } from "./services/MarketDataService";
