import { elizaLogger } from "@ai16z/eliza";
import BetterSqlite3 from "better-sqlite3";
import {
    IMarketDatabaseAdapter,
    MarketData,
    Category, 
    MarketAnalysis,
    MarketAnalysisParams,
    Database,
    Statement,
    VolumeLeader,
    PriceMover
} from "./types";

export class MarketDatabaseAdapter implements IMarketDatabaseAdapter {
    public db!: Database;
    private prepared: Map<string, Statement> = new Map();

    constructor(dbPath: string, private circuitBreakerConfig?: {
        failureThreshold?: number;
        resetTimeout?: number;
        halfOpenMaxAttempts?: number;
    }) {
        // Initialize SQLite database with optimizations
        this.db = new BetterSqlite3(dbPath, {
            verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
        });

        // Set pragmas for better performance
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
    }

    async init(): Promise<void> {
        try {
            // Initialize schema
            const schema = require('./schema.sql').default;
            this.db.exec(schema);

            // Prepare commonly used statements
            this.prepareStatements();

            // Initialize default categories if they don't exist
            await this.initializeDefaultCategories();

            elizaLogger.info('Market database initialized successfully');
        } catch (error) {
            elizaLogger.error('Failed to initialize market database:', error);
            throw error;
        }
    }

    private prepareStatements(): void {
        // Prepare statements for better performance
        this.prepared.set('insertMarketData', this.db.prepare(`
            INSERT INTO market_data (
                coin_id, current_price, market_cap, total_volume,
                market_cap_rank, price_change_percentage_1h,
                price_change_percentage_24h, price_change_percentage_7d,
                price_change_percentage_14d, price_change_percentage_30d,
                timestamp
            ) VALUES (
                @coin_id, @current_price, @market_cap, @total_volume,
                @market_cap_rank, @price_change_percentage_1h,
                @price_change_percentage_24h, @price_change_percentage_7d,
                @price_change_percentage_14d, @price_change_percentage_30d,
                @timestamp
            )
        `));

        this.prepared.set('insertCoin', this.db.prepare(`
            INSERT OR IGNORE INTO coins (id, symbol, name)
            VALUES (@id, @symbol, @name)
        `));

        this.prepared.set('assignCategory', this.db.prepare(`
            INSERT OR IGNORE INTO coin_categories (coin_id, category_id)
            VALUES (@coin_id, @category_id)
        `));
    }

    private async initializeDefaultCategories(): Promise<void> {
        const defaultCategories = [
            { id: 'base-ecosystem', name: 'Base Ecosystem', description: 'Tokens native to the Base ecosystem' },
            { id: 'base-meme-coins', name: 'Base Meme Coins', description: 'Meme tokens on the Base network' }
        ];

        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO token_categories (id, name, description)
            VALUES (@id, @name, @description)
        `);

        const transaction = this.db.transaction((categories: typeof defaultCategories) => {
            for (const category of categories) {
                stmt.run(category);
            }
        });

        transaction(defaultCategories);
    }

    async storeMarketData(data: MarketData[]): Promise<void> {
        const transaction = this.db.transaction((marketData: MarketData[]) => {
            for (const item of marketData) {
                // Store coin information
                this.prepared.get('insertCoin')!.run({
                    id: item.id,
                    symbol: item.symbol,
                    name: item.name
                });

                // Store market data
                this.prepared.get('insertMarketData')!.run({
                    ...item,
                    timestamp: item.timestamp || new Date().toISOString()
                });
            }
        });

        transaction(data);
    }

    async getMarketAnalysis(params: MarketAnalysisParams): Promise<MarketAnalysis> {
        const limit = params.timeframe === '24h' ? (params.limit || 5) : (params.limit || 10);
        const categoryFilter = params.category ? 'AND cc.category_id = ?' : '';

        interface VolumeLeaderRow {
            name: string;
            symbol: string;
            volume_change: number;
            price_change: number;
        }

        interface PriceMoverRow {
            name: string;
            symbol: string;
            price_change: number;
            volume: number;
        }

        const volumeLeadersRaw = this.db.prepare(`
            WITH recent AS (
                SELECT * FROM market_data
                WHERE timestamp >= datetime('now', '-1 day')
                ORDER BY timestamp DESC
                LIMIT 1
            )
            SELECT 
                c.name,
                c.symbol,
                ((r.total_volume - m.total_volume) / m.total_volume * 100) as volume_change,
                ((r.current_price - m.current_price) / m.current_price * 100) as price_change
            FROM market_data m
            JOIN coins c ON m.coin_id = c.id
            JOIN recent r ON m.coin_id = r.coin_id
            JOIN coin_categories cc ON c.id = cc.coin_id
            WHERE m.timestamp >= datetime('now', '-2 days')
            ${categoryFilter}
            ORDER BY volume_change DESC
            LIMIT ?
        `).all(params.category ? [params.category, limit] : [limit]) as VolumeLeaderRow[];

        const priceMoversRaw = this.db.prepare(`
            SELECT 
                c.name,
                c.symbol,
                m.price_change_percentage_24h as price_change,
                m.total_volume as volume
            FROM market_data m
            JOIN coins c ON m.coin_id = c.id
            JOIN coin_categories cc ON c.id = cc.coin_id
            WHERE m.timestamp = (
                SELECT MAX(timestamp) FROM market_data
            )
            ${categoryFilter}
            ORDER BY ABS(price_change_percentage_24h) DESC
            LIMIT ?
        `).all(params.category ? [params.category, limit] : [limit]) as PriceMoverRow[];

        const volumeLeaders = volumeLeadersRaw.map(row => ({
            name: row.name,
            symbol: row.symbol,
            volume_change: row.volume_change,
            price_change: row.price_change
        })) as VolumeLeader[];

        const priceMovers = priceMoversRaw.map(row => ({
            name: row.name,
            symbol: row.symbol,
            price_change: row.price_change,
            volume_change: ((row.volume / 100) - 1) * 100
        })) as PriceMover[];

        return {
            volumeLeaders,
            priceMovers
        };
    }

    async addCategory(category: Category): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT INTO token_categories (id, name, description)
            VALUES (@id, @name, @description)
        `);
        stmt.run(category);
    }

    async assignCategoryToToken(coinId: string, categoryId: string): Promise<void> {
        this.prepared.get('assignCategory')!.run({
            coin_id: coinId,
            category_id: categoryId
        });
    }

    async cleanOldData(retentionDays: number = 30): Promise<void> {
        const result = this.db.prepare(`
            DELETE FROM market_data 
            WHERE timestamp < datetime('now', '-' || ? || ' days')
        `).run(retentionDays);

        elizaLogger.info(`Cleaned up ${result.changes} old market data records`);
    }

    async close(): Promise<void> {
        this.db.close();
    }
}