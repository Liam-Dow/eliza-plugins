import { Action, IAgentRuntime, Memory, HandlerCallback, State, elizaLogger } from "@ai16z/eliza";
import { CoingeckoService } from '../services/coingeckoService';

export const getTrendingAction: Action = {
    name: "GET_CRYPTO_TRENDING",
    similes: ["CHECK_CRYPTO_TRENDS", "CRYPTO_TRENDS", "HOT_CRYPTO", "POPULAR_CRYPTO"],
    description: "Get information about currently trending cryptocurrencies",
    
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        
        const hasTrendingKeyword = text.includes('trending') || 
                                 text.includes('popular') || 
                                 text.includes('hot');
        const hasCryptoKeyword = text.includes('crypto') || 
                                text.includes('coin') || 
                                text.includes('currencies');
        
        return hasTrendingKeyword && hasCryptoKeyword;
    },
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,                                    // Made optional with ?
        options?: { [key: string]: unknown },            // Made optional and typed correctly
        callback?: HandlerCallback                       // Made optional with ?
    ): Promise<unknown> => {                            // Changed return type to Promise<unknown>
        try {
            const service = new CoingeckoService();
            const trending = await service.getTrending();
            
            const trendingList = trending
                .slice(0, 5)
                .map((coin, index) => {
                    const rank = coin.item.market_cap_rank || 'N/A';
                    return `${index + 1}. ${coin.item.name} (${coin.item.symbol.toUpperCase()})\n` +
                           `   📊 Market Cap Rank: #${rank}\n` +
                           `   💰 Price in BTC: ${coin.item.price_usd.toFixed(8)}`;
                })
                .join('\n\n');
    
            if (callback) {
                callback(
                    {
                        text: `🔥 Here are the currently trending cryptocurrencies:\n\n${trendingList}`
                    },
                    []
                );
            }
    
            return {
                trending: trending.slice(0, 5),
                timestamp: new Date().toISOString()
            };
    
        } catch (error) {
            elizaLogger.error('Error in getTrendingAction:', error);
            
            if (callback) {
                callback(
                    { text: "I encountered an error while fetching trending cryptocurrency data. Please try again later." },
                    []
                );
            }
            
            return null;
        }
    }
};
