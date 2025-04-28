import { Action, IAgentRuntime, Memory, HandlerCallback, State, elizaLogger, generateText, ModelClass } from "@ai16z/eliza";
import { CoingeckoService } from '../services/coingeckoService';

export const getPriceAction: Action = {
    name: "GET_CRYPTO_PRICE",
    similes: ["CHECK_CRYPTO_PRICE", "CRYPTO_PRICE_CHECK", "COIN_PRICE"],
    description: "Get current price and market data for a specific cryptocurrency",
    
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        
        const pricePatterns = [
            /price/,
            /cost/,
            /worth/,
            /value/,
            /how\s+much/,
            /trading\s+at/
        ];
        const hasPricePattern = pricePatterns.some(pattern => pattern.test(text));
        
        const cryptoPatterns = [
            /crypto/,
            /coin/,
            /\b(btc|bitcoin)\b/,
            /\b(eth|ethereum)\b/,
            /\b(sol|solana)\b/,
            /\b(doge|dogecoin)\b/,
            /\b(xrp|ripple)\b/
        ];
        const hasCryptoPattern = cryptoPatterns.some(pattern => pattern.test(text));
        
        elizaLogger.debug('Validating crypto price action:', {
            text,
            hasPricePattern,
            hasCryptoPattern
        });
        
        return hasPricePattern && hasCryptoPattern;
    },
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<unknown> => {
        try {
            elizaLogger.debug('Starting GET_CRYPTO_PRICE handler');
    
            const text = message.content.text.toLowerCase();
            let coin = '';
            let type = 'price';
    
            const cryptoMatches = text.match(/\b(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple)\b/i);
            if (cryptoMatches) {
                coin = cryptoMatches[0];
            }
    
            if (!coin) {
                const extractionResult = await generateText({
                    runtime,
                    context: `Which cryptocurrency is being asked about in this message: "${message.content.text}"? Reply with just the coin name, like "bitcoin" or "ethereum".`,
                    modelClass: ModelClass.SMALL
                });
                coin = extractionResult.toLowerCase().trim();
            }
    
            if (text.includes('market cap') || text.includes('marketcap')) {
                type = 'market_cap';
            } else if (text.includes('volume')) {
                type = 'volume';
            } else if (text.includes('all') || text.includes('stats') || text.includes('information')) {
                type = 'all';
            }
    
            elizaLogger.debug('Extracted info', {
                coin: coin || 'not found',
                type: type || 'unknown'
            });
    
            const service = new CoingeckoService();
            const searchResults = await service.searchCoins(coin);
            
    
            if (searchResults.length === 0) {
                if (callback) {
                    callback(
                        { text: `I couldn't find any cryptocurrency matching "${coin}". Please check the name and try again.` },
                        []
                    );
                }
                return null;
            }
    
            const coinData = await service.getPrice(searchResults[0].id);
            
            let responseText = `Here's the ${type === 'all' ? 'market data' : type.replace('_', ' ')} for ${searchResults[0].name}:\n`;
            
            if (type === 'price' || type === 'all') {
                responseText += `💰 Price: $${coinData.current_price.toLocaleString()}\n`;
            }
            if (type === 'market_cap' || type === 'all') {
                responseText += `📊 Market Cap: $${coinData.market_cap.toLocaleString()}\n`;
            }
            if (type === 'volume' || type === 'all') {
                responseText += `📈 24h Volume: $${coinData.total_volume.toLocaleString()}\n`;
            }
            if (type === 'all') {
                responseText += `📊 24h Change: ${coinData.price_change_percentage_24h.toFixed(2)}%\n`;
                responseText += `🕒 Last Updated: ${new Date(coinData.last_updated).toLocaleString()}`;
            }
    
            if (callback) {
                callback({ text: responseText }, []);
            }
    
            return {
                coin: searchResults[0],
                data: coinData,
                timestamp: new Date().toISOString()
            };
    
        } catch (error) {
            elizaLogger.error('Error in getPriceAction:', error);
            if (callback) {
                callback(
                    { text: "I encountered an error while fetching cryptocurrency data. Please try again later." },
                    []
                );
            }
            return null;
        }
    }
};
