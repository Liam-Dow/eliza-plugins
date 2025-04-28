import {
    Provider,
    IAgentRuntime,
    Memory,
    State,
    ServiceType,
    elizaLogger,
} from "@ai16z/eliza";
import { MarketDataService } from "../services/marketDataService";
import { MarketOverview, NotableMover } from "../types";
import { TokenInfoService } from "../services/tokenInfoService";

export const marketDataProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const marketDataService = runtime.getService<MarketDataService>(
                ServiceType.BASE_MARKET_DATA
            );

            if (!marketDataService) {
                elizaLogger.error("Market data service not available");
                return "Market data currently unavailable.";
            }

            const overview = await marketDataService.getMarketOverview();
            const movers = await marketDataService.getNotableMovers();

            // Format the response
            const formatPrice = (price: number) =>
                price.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                });

            const formatPercentage = (value: number) =>
                `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

            const formatMarketCap = (value: number) =>
                `$${(value / 1000000).toFixed(2)}M`;

            const response = `
# Base Market Overview

## Market Statistics (Top 100 Tokens)
Total Market Cap: ${formatMarketCap(overview.total_market_cap)}
24h Trading Volume: ${formatMarketCap(overview.total_volume)}
Number of Tokens: ${overview.total_tokens}

## Market Performance

24h Performance:
• Average Change: ${formatPercentage(overview.avg_24h_change)}
• Strong Performers (>10%): ${overview.strong_performers_24h}
• Moderate Performers (5-10%): ${overview.moderate_performers_24h}
• Strong Decliners (<-10%): ${overview.strong_decliners_24h}

7d Performance:
• Average Change: ${formatPercentage(overview.avg_7d_change)}
• Strong Performers (>10%): ${overview.strong_performers_7d}
• Moderate Performers (5-10%): ${overview.moderate_performers_7d}
• Strong Decliners (<-10%): ${overview.strong_decliners_7d}

30d Performance:
• Average Change: ${formatPercentage(overview.avg_30d_change)}
• Strong Performers (>10%): ${overview.strong_performers_30d}
• Moderate Performers (5-10%): ${overview.moderate_performers_30d}
• Strong Decliners (<-10%): ${overview.strong_decliners_30d}

## Notable Movers

24h Top Movers:
${movers
    .filter((m) => m.timeframe === "last_24h")
    .map(
        (m) =>
            `• ${m.name} (${m.symbol}): ${formatPercentage(m.price_change)} | Price: ${formatPrice(m.current_price)} | Volume: ${formatMarketCap(m.total_volume)}`
    )
    .join("\n")}

7d Top Movers:
${movers
    .filter((m) => m.timeframe === "last_7d")
    .map(
        (m) =>
            `• ${m.name} (${m.symbol}): ${formatPercentage(m.price_change)} | Price: ${formatPrice(m.current_price)} | Volume: ${formatMarketCap(m.total_volume)}`
    )
    .join("\n")}

30d Top Movers:
${movers
    .filter((m) => m.timeframe === "last_30d")
    .map(
        (m) =>
            `• ${m.name} (${m.symbol}): ${formatPercentage(m.price_change)} | Price: ${formatPrice(m.current_price)} | Volume: ${formatMarketCap(m.total_volume)}`
    )
    .join("\n")}
`.trim();

            return response;
        } catch (error) {
            elizaLogger.error("Error in marketDataProvider:", error);
            return "Error retrieving market data. Please try again later.";
        }
    },
};
