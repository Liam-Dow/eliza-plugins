import { Plugin } from "@ai16z/eliza";
import type { Database } from "better-sqlite3";
import { marketDataProvider } from "./providers/marketDataProvider";
import { MarketDataService } from "./services/marketDataService";
import { TokenInfoService } from "./services/tokenInfoService";

export const baseMarketPlugin = (db: Database): Plugin => ({
    name: "base-market",
    description: "Provides market data analysis for Base ecosystem tokens",
    providers: [marketDataProvider],
    services: [new MarketDataService(db), new TokenInfoService(db)],
});

export * from "./types";
