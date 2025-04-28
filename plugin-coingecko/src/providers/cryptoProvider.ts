import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@ai16z/eliza";
import { MarketDatabaseAdapter } from "@ai16z/adapter-marketdatabase";

// Type definitions for market analysis data
interface MarketMover {
    name: string;
    symbol: string;
    price_change?: number;
    volume_change?: number;
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    price_change_percentage_14d?: number;
    price_change_percentage_30d?: number;
}

interface RankChange {
    name: string;
    rank_change: number;
    current_rank: number;
}

interface MarketAnalysis {
    volumeLeaders: MarketMover[];
    priceMovers: MarketMover[];
    rankingChanges?: RankChange[];
}

export const cryptoProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const adapter = runtime.databaseAdapter as typeof MarketDatabaseAdapter;
            
            // Analyze ecosystem and meme tokens separately
            const [ecosystemAnalysis, memeAnalysis] = await Promise.all([
                adapter.getMarketAnalysis({
                    timeframe: '24h',
                    category: 'base-ecosystem',
                    limit: 10
                }),
                adapter.getMarketAnalysis({
                    timeframe: '24h',
                    category: 'base-meme-coins',
                    limit: 10
                })
            ]);

            return `Base Ecosystem Market Analysis:

Market Movement Summary:
In the Base ecosystem, the most significant volume increase in the past 24 hours is shown by ${formatTopMover(ecosystemAnalysis.volumeLeaders[0])}, while ${formatTopMover(ecosystemAnalysis.priceMovers[0])} leads in price appreciation. Among meme tokens, ${formatTopMover(memeAnalysis.volumeLeaders[0])} shows the highest volume activity.

Notable Price Movements:
The largest price changes over multiple timeframes for ecosystem tokens:
24h: ${formatPriceChanges(ecosystemAnalysis.priceMovers, '24h')}
7d: ${formatPriceChanges(ecosystemAnalysis.priceMovers, '7d')}
14d: ${formatPriceChanges(ecosystemAnalysis.priceMovers, '14d')}
30d: ${formatPriceChanges(ecosystemAnalysis.priceMovers, '30d')}

Volume Analysis:
Significant volume changes in ecosystem tokens:
${analyzeVolumePatterns(ecosystemAnalysis.volumeLeaders)}

Market Cap Rank Changes:
Most significant rank movements in the past 7 days:
${formatRankChanges(ecosystemAnalysis.rankingChanges || [])}

Price-Volume Relationships:
${analyzePriceVolumeRelationships(ecosystemAnalysis)}

Market Dynamics:
${analyzeMarketDynamics(ecosystemAnalysis, memeAnalysis)}

Data current as of ${new Date().toISOString()}`;

        } catch (error) {
            elizaLogger.error('Error in cryptoProvider:', error);
            return "Base market analysis temporarily unavailable. Data collection and analysis will resume when system access is restored.";
        }
    }
};

function formatTopMover(mover: MarketMover): string {
    return `${mover.name} (${mover.symbol.toUpperCase()}) with ${Math.abs(mover.price_change || mover.volume_change || 0).toFixed(2)}% change`;
}

function formatPriceChanges(movers: MarketMover[], timeframe: string): string {
    const changeKey = `price_change_percentage_${timeframe}`;
    const topMover = movers[0];
    return `${topMover.name} (${topMover.symbol.toUpperCase()}) ${topMover[changeKey] > 0 ? 'up' : 'down'} ${Math.abs(topMover[changeKey] || 0).toFixed(2)}%`;
}

function analyzeVolumePatterns(volumeLeaders: MarketMover[]): string {
    const increasingVolume = volumeLeaders.filter(l => (l.volume_change ?? 0) > 0);
    const significantIncreases = volumeLeaders.filter(l => (l.volume_change ?? 0) > 50);

    return `${increasingVolume.length} of the top ${volumeLeaders.length} tokens show increased volume, with ${significantIncreases.length} showing increases above 50%. ${
        significantIncreases.length > 0 
            ? `Most notable is ${significantIncreases[0].name} with ${significantIncreases[0].volume_change?.toFixed(2) ?? '0'}% volume increase.`
            : 'No tokens show extreme volume changes, indicating stable trading conditions.'
    }`;
}

function formatRankChanges(rankChanges: RankChange[]): string {
    return rankChanges
        .filter(change => Math.abs(change.rank_change) > 0)
        .map(change => 
            `${change.name} moved ${Math.abs(change.rank_change)} positions ${change.rank_change < 0 ? 'up' : 'down'} to rank #${change.current_rank}`
        )
        .join('. ');
}

function analyzePriceVolumeRelationships(analysis: MarketAnalysis): string {
    const correlatedMoves = analysis.priceMovers
        .filter(m => Math.sign(m.price_change || 0) === Math.sign(m.volume_change || 0))
        .length;
    
    const tokens = analysis.priceMovers.length;
    const correlationRatio = correlatedMoves / tokens;

    return `${correlatedMoves} out of ${tokens} tokens show correlated price and volume movements. ${
        correlationRatio > 0.7 
            ? 'This strong correlation suggests coordinated market interest across multiple tokens.'
            : correlationRatio > 0.4 
                ? 'This mixed correlation indicates selective market participation.'
                : 'This weak correlation suggests divergent trading patterns across tokens.'
    }`;
}

function analyzeMarketDynamics(ecosystemAnalysis: MarketAnalysis, memeAnalysis: MarketAnalysis): string {
    const ecosystemMeanChange = average(ecosystemAnalysis.priceMovers.map(m => m.price_change || 0));
    const memeMeanChange = average(memeAnalysis.priceMovers.map(m => m.price_change || 0));
    
    const ecosystemVolumeChange = average(ecosystemAnalysis.volumeLeaders.map(m => m.volume_change || 0));
    const memeVolumeChange = average(memeAnalysis.volumeLeaders.map(m => m.volume_change || 0));

    return `Base ecosystem tokens are showing an average price change of ${ecosystemMeanChange.toFixed(2)}% with ${ecosystemVolumeChange.toFixed(2)}% volume change, while meme tokens average ${memeMeanChange.toFixed(2)}% price change with ${memeVolumeChange.toFixed(2)}% volume change. ${
        Math.sign(ecosystemMeanChange) === Math.sign(memeMeanChange)
            ? 'Both sectors are moving in alignment, suggesting broader market momentum.'
            : 'The sectors are moving independently, indicating sector-specific dynamics.'
    }`;
}

function average(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}