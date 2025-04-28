import { z } from "zod";
import type { Database, Statement } from "better-sqlite3";

// Define and export the MarketTimeframe type
export type MarketTimeframe = '24h' | '7d' | '30d';

// Core market data types
export interface MarketData {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    market_cap_rank: number | null;
    price_change_percentage_1h: number | null;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d: number | null;
    price_change_percentage_14d: number | null;
    price_change_percentage_30d: number | null;
    timestamp: string;
}

export interface Category {
    id: string;
    name: string;
    description?: string;
}

// Analysis result types - Now explicitly exported
export interface VolumeLeader {
    name: string;
    symbol: string;
    volume_change: number;
    price_change: number;
}

export interface PriceMover {
    name: string;
    symbol: string;
    price_change: number;
    volume_change: number;
}

export interface MarketAnalysis {
    volumeLeaders: VolumeLeader[];
    priceMovers: PriceMover[];
}

// Analysis parameters
export interface MarketAnalysisParams {
    timeframe: MarketTimeframe;  // Now using the exported type
    category?: string;
    limit?: number;
}

// Database interface
export interface IMarketDatabaseAdapter {
    init(): Promise<void>;
    close(): Promise<void>;
    storeMarketData(data: MarketData[]): Promise<void>;
    getMarketAnalysis(params: MarketAnalysisParams): Promise<MarketAnalysis>;
    addCategory(category: Category): Promise<void>;
    assignCategoryToToken(coinId: string, categoryId: string): Promise<void>;
    cleanOldData(retentionDays?: number): Promise<void>;
}

// Export database types from better-sqlite3
export { Database, Statement };