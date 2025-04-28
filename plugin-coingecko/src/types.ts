import { z } from "zod";
import { IAgentRuntime } from "@ai16z/eliza";

// First add our new MarketData interface that matches the processed data structure
export interface MarketData {
    id: string;
    symbol: string;
    name: string;
    category: 'base-ecosystem' | 'base-meme-coins'; // See categories listed here: https://docs.coingecko.com/reference/coins-categories-list
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

// Add new schema for the expanded CoinGecko API response
export const CoinGeckoMarketDataResponseSchema = z.array(z.object({
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

// First, let's define our CoinGecko API response validation schemas
export const CoinGeckoResponseSchema = z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    current_price: z.number(),
    market_cap: z.number(),
    total_volume: z.number(),
    price_change_percentage_24h: z.number(),
    last_updated: z.string()
}).transform(data => ({
    ...data,
    current_price: Number(data.current_price),
    market_cap: Number(data.market_cap),
    total_volume: Number(data.total_volume),
    price_change_percentage_24h: Number(data.price_change_percentage_24h)
}));

export const TrendingItemResponseSchema = z.object({
    item: z.object({
        id: z.string(),
        name: z.string(),
        symbol: z.string(),
        market_cap_rank: z.number().nullable(),
        price_usd: z.number()
    })
});

// TypeScript interfaces for internal use
export interface CoinData {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    price_change_percentage_24h: number;
    last_updated: string;
}

export interface TrendingCoin {
    item: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number | null;
        price_usd: number;
    }
}

// Type for the extracted information from user messages
export interface CoinRequest {
    coin: string;
    type: 'price' | 'market_cap' | 'volume' | 'all';
}

// Helper function to validate CoinGecko API responses
export function validateCoinGeckoResponse(data: unknown): CoinData {
    const result = CoinGeckoResponseSchema.safeParse(data);
    if (!result.success) {
        throw new Error(`Invalid CoinGecko response: ${result.error.message}`);
    }
    return result.data;
}

// Helper function to validate trending coin responses
export function validateTrendingResponse(data: unknown): TrendingCoin {
    const result = TrendingItemResponseSchema.safeParse(data);
    if (!result.success) {
        throw new Error(`Invalid trending coin response: ${result.error.message}`);
    }
    return result.data;
}

export const SearchResultSchema = z.object({
    id: z.string(),
    name: z.string(),
    symbol: z.string(),
    market_cap_rank: z.number().nullable(),
    thumb: z.string().optional(),
    large: z.string().optional()
});

// Interface for search results
export interface SearchResult {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    thumb?: string;
    large?: string;
}

// Validation function for search results
export function validateSearchResults(data: unknown): SearchResult[] {
    // If it's an array, validate each item
    if (!Array.isArray(data)) {
        throw new Error('Search results must be an array');
    }
    
    return data.map(item => {
        const result = SearchResultSchema.safeParse(item);
        if (!result.success) {
            throw new Error(`Invalid search result: ${result.error.message}`);
        }
        return result.data;
    });
}

// Validation function for trending results
export function validateTrendingResults(data: unknown): TrendingCoin[] {
    if (!Array.isArray(data)) {
        throw new Error('Trending results must be an array');
    }
    
    return data.map(item => {
        const result = TrendingItemResponseSchema.safeParse(item);
        if (!result.success) {
            throw new Error(`Invalid trending result: ${result.error.message}`);
        }
        return result.data;
    });
}