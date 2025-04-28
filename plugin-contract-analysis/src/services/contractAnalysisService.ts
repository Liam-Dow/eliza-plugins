import {
    Service,
    ServiceType,
    IAgentRuntime,
    elizaLogger,
    MemoryManager,
} from "@ai16z/eliza";
import type { UUID } from "@ai16z/eliza";
import {
    GoPlusLabsResponse,
    StoredContractAnalysis,
    ContractAnalysisSummary,
    LiquidityAnalysis,
    DEAD_ADDRESSES,
} from "../types";

export class ContractAnalysisService extends Service {
    static serviceType = ServiceType.CONTRACT_ANALYSIS;
    private memoryManager: MemoryManager | null = null;
    private runtime: IAgentRuntime | null = null;
    private readonly ANALYSIS_CACHE_DURATION = 3600000;

    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        this.memoryManager = new MemoryManager({
            runtime,
            tableName: "contract_analysis",
        });

        runtime.registerMemoryManager(this.memoryManager);

        elizaLogger.success("[ContractAnalysisService] Initialized");
    }

    async storeAnalysis(
        analysis: StoredContractAnalysis,
        roomId: UUID
    ): Promise<void> {
        if (!this.memoryManager) throw new Error("Service not initialized");

        await this.memoryManager.createMemory({
            id: crypto.randomUUID() as UUID,
            content: {
                text: "Contract Analysis",
                data: analysis,
                type: "contract_analysis",
            },
            roomId,
            userId: this.runtime?.agentId as UUID,
            agentId: this.runtime?.agentId as UUID,
            createdAt: Date.now(),
        });
    }

    async getRecentAnalysis(
        roomId: UUID
    ): Promise<StoredContractAnalysis | null> {
        if (!this.memoryManager) throw new Error("Service not initialized");

        const analyses = await this.memoryManager.getMemories({
            roomId,
            count: 1,
        });

        return (analyses[0]?.content?.data as StoredContractAnalysis) || null;
    }

    private generateAnalysisRoomId(contractAddress: string): UUID {
        const prefix = "ca";
        const normalized = contractAddress.toLowerCase().replace("0x", "");
        return `${prefix}000-0000-0000-0000-${normalized.slice(0, 12)}` as UUID;
    }

    async analyzeContract(
        contractAddress: string
    ): Promise<GoPlusLabsResponse> {
        try {
            const analysisRoomId = this.generateAnalysisRoomId(contractAddress);

            elizaLogger.debug("[ContractAnalysisService] Checking cache", {
                contractAddress,
                analysisRoomId,
                service: ServiceType.CONTRACT_ANALYSIS,
            });

            const cachedAnalyses = await this.memoryManager.getMemories({
                roomId: analysisRoomId,
                count: 1,
                unique: true,
            });

            const cachedAnalysis = cachedAnalyses[0];
            if (
                cachedAnalysis &&
                Date.now() - cachedAnalysis.createdAt <
                    this.ANALYSIS_CACHE_DURATION
            ) {
                elizaLogger.debug(
                    "[ContractAnalysisService] Using cached analysis",
                    {
                        contractAddress,
                        cacheAge: Date.now() - cachedAnalysis.createdAt,
                        analysisId: cachedAnalysis.id,
                    }
                );
                return JSON.parse(cachedAnalysis.content.text);
            }

            elizaLogger.debug(
                "[ContractAnalysisService] Fetching fresh analysis",
                {
                    contractAddress,
                    service: ServiceType.CONTRACT_ANALYSIS,
                }
            );

            const response = await fetch(
                `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${contractAddress}`,
                {
                    headers: { accept: "*/*" },
                }
            );

            if (!response.ok) {
                elizaLogger.error(
                    "[ContractAnalysisService] API request failed",
                    {
                        contractAddress,
                        status: response.status,
                        statusText: response.statusText,
                        service: ServiceType.CONTRACT_ANALYSIS,
                    }
                );
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data: GoPlusLabsResponse = await response.json();

            await this.memoryManager.createMemory({
                id: crypto.randomUUID() as UUID,
                content: {
                    text: JSON.stringify(data),
                    type: "raw_contract_analysis",
                },
                roomId: analysisRoomId,
                userId: this.runtime?.agentId as UUID,
                agentId: this.runtime?.agentId as UUID,
                createdAt: Date.now(),
            });

            return data;
        } catch (error) {
            elizaLogger.error("[ContractAnalysisService] Analysis failed", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                contractAddress,
                service: ServiceType.CONTRACT_ANALYSIS,
            });
            throw error;
        }
    }

    async getAnalysisHistory(
        contractAddress: string
    ): Promise<GoPlusLabsResponse[]> {
        try {
            const analysisRoomId = this.generateAnalysisRoomId(contractAddress);

            elizaLogger.debug(
                "[ContractAnalysisService] Retrieving analysis history",
                {
                    contractAddress,
                    analysisRoomId,
                    service: ServiceType.CONTRACT_ANALYSIS,
                }
            );

            const analyses = await this.memoryManager.getMemories({
                roomId: analysisRoomId,
                count: 10,
                unique: false,
            });

            elizaLogger.debug(
                "[ContractAnalysisService] Analysis history retrieved",
                {
                    contractAddress,
                    analysisCount: analyses.length,
                    service: ServiceType.CONTRACT_ANALYSIS,
                }
            );

            return analyses.map((analysis) =>
                JSON.parse(analysis.content.text)
            );
        } catch (error) {
            elizaLogger.error(
                "[ContractAnalysisService] Failed to retrieve analysis history",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    contractAddress,
                    service: ServiceType.CONTRACT_ANALYSIS,
                }
            );
            throw error;
        }
    }

    async clearOldAnalyses(
        olderThan: number = 7 * 24 * 60 * 60 * 1000
    ): Promise<void> {
        try {
            const cutoffTime = Date.now() - olderThan;
            const batchSize = 100; // Process in batches of 100
            let cleared = 0;

            elizaLogger.debug("[ContractAnalysisService] Starting cleanup", {
                cutoffTime,
                batchSize,
                service: ServiceType.CONTRACT_ANALYSIS,
            });

            // Get list of unique contract rooms
            const contractRooms = new Set<UUID>();
            let memories = await this.memoryManager.getMemories({
                roomId: this.memoryManager.runtime.agentId,
                count: batchSize,
            });

            // Collect unique room IDs
            memories.forEach((memory) => {
                if (memory.content.type === "contract_analysis") {
                    contractRooms.add(memory.roomId);
                }
            });

            elizaLogger.debug(
                "[ContractAnalysisService] Found contract rooms",
                {
                    roomCount: contractRooms.size,
                    service: ServiceType.CONTRACT_ANALYSIS,
                }
            );

            // Process each contract room
            for (const roomId of contractRooms) {
                let hasMore = true;

                while (hasMore) {
                    const analyses = await this.memoryManager.getMemories({
                        roomId,
                        count: batchSize,
                    });

                    // Filter for old analyses
                    const oldAnalyses = analyses.filter(
                        (analysis) => analysis.createdAt < cutoffTime
                    );

                    elizaLogger.debug(
                        "[ContractAnalysisService] Processing room batch",
                        {
                            roomId,
                            totalAnalyses: analyses.length,
                            oldAnalysesCount: oldAnalyses.length,
                            service: ServiceType.CONTRACT_ANALYSIS,
                        }
                    );

                    // Process deletions
                    for (const analysis of oldAnalyses) {
                        if (analysis.id) {
                            try {
                                await this.memoryManager.removeMemory(
                                    analysis.id
                                );
                                cleared++;
                            } catch (deleteError) {
                                elizaLogger.error(
                                    "[ContractAnalysisService] Failed to delete analysis",
                                    {
                                        error:
                                            deleteError instanceof Error
                                                ? deleteError.message
                                                : String(deleteError),
                                        stack:
                                            deleteError instanceof Error
                                                ? deleteError.stack
                                                : undefined,
                                        analysisId: analysis.id,
                                        roomId,
                                        service: ServiceType.CONTRACT_ANALYSIS,
                                    }
                                );
                            }
                        }
                    }

                    // Check if we need to continue processing this room
                    hasMore = analyses.length === batchSize;
                }
            }

            elizaLogger.success("[ContractAnalysisService] Cleanup completed", {
                clearedCount: cleared,
                roomCount: contractRooms.size,
                service: ServiceType.CONTRACT_ANALYSIS,
            });
        } catch (error) {
            elizaLogger.error("[ContractAnalysisService] Cleanup failed", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                service: ServiceType.CONTRACT_ANALYSIS,
            });
            throw error;
        }
    }
    async formatAnalysisData(
        contractData: any,
        contractAddress: string
    ): Promise<{
        safety: ContractAnalysisSummary;
        formattedAnalysis: string;
    }> {
        elizaLogger.debug(
            "[ContractAnalysisService] Formatting analysis data",
            {
                contractAddress,
                service: ServiceType.CONTRACT_ANALYSIS,
            }
        );

        const safety = this.analyzeContractSafety(contractData);
        const formattedAnalysis = this.formatContractAnalysis(contractData);

        return { safety, formattedAnalysis };
    }
    private analyzeContractSafety(contractData: any): ContractAnalysisSummary {
        const riskFactors = [];
        const keyPoints = [];

        // Check for major red flags
        if (contractData.is_honeypot === "1") {
            riskFactors.push("contract is a honeypot");
        }
        if (contractData.is_blacklisted === "1") {
            riskFactors.push("contract has blacklist function");
        }
        if (contractData.transfer_pausable === "1") {
            riskFactors.push("trading can be paused");
        }
        if (contractData.hidden_owner === "1") {
            riskFactors.push("contract has hidden owner");
        }
        if (contractData.is_mintable === "1") {
            riskFactors.push("token supply can be increased");
        }
        if (contractData.is_proxy === "1") {
            riskFactors.push("contract logic can be changed");
        }

        // Check positive aspects
        if (contractData.is_open_source === "1") {
            keyPoints.push("contract is open source");
        }

        // Analyze taxes
        const buyTax = Number(contractData.buy_tax || 0) * 100;
        const sellTax = Number(contractData.sell_tax || 0) * 100;
        if (buyTax > 0 || sellTax > 0) {
            keyPoints.push(`has taxes (Buy: ${buyTax}%, Sell: ${sellTax}%)`);
        }

        // Analyze liquidity
        const liquidityAnalysis = this.analyzeLiquidity(contractData);
        const liquidityStatus = {
            hasLiquidity: liquidityAnalysis.totalLiquidity > 0,
            totalLiquidity: liquidityAnalysis.totalLiquidity,
            isLocked: liquidityAnalysis.lockedLiquidity.percentage > 50,
            isBurned: liquidityAnalysis.burnedLiquidity.percentage > 50,
        };

        return {
            isSafe: riskFactors.length === 0,
            riskFactors,
            keyPoints,
            liquidityStatus,
        };
    }

    private formatContractAnalysis(contractData: any): string {
        try {
            elizaLogger.debug("[ContractAnalysis] Formatting contract data", {
                hasData: !!contractData,
                action: "ANALYZE_CONTRACT",
            });

            // First validate we have data
            if (!contractData || typeof contractData !== "object") {
                throw new Error(
                    `Invalid contract data: ${JSON.stringify(contractData)}`
                );
            }

            // Extract all data at root level
            const {
                token_name,
                token_symbol,
                holder_count,
                total_supply,
                is_open_source,
                is_proxy,
                is_mintable,
                hidden_owner,
                is_honeypot,
                buy_tax,
                sell_tax,
                is_blacklisted,
                transfer_pausable,
            } = contractData;

            // Format sections
            const sections = [];

            // Token Info Section
            const tokenInfo = [
                "💎 Token Info:",
                `• Name: ${token_name || "Unknown"}`,
                `• Symbol: ${token_symbol || "Unknown"}`,
                `• Holders: ${holder_count ? Number(holder_count).toLocaleString() : "Unknown"}`,
                `• Total Supply: ${total_supply ? Number(total_supply).toLocaleString() : "Unknown"}`,
            ].join("\n");
            sections.push(tokenInfo);

            // Security Status Section
            const securityStatus = [
                "🔒 Security Status:",
                `• Verified Contract: ${is_open_source === "1" ? "✅ Yes" : "⚠️ No"}`,
                `• Proxy Contract: ${is_proxy === "1" ? "⚠️ Yes" : "✅ No"}`,
                `• Mintable: ${is_mintable === "1" ? "⚠️ Yes" : "✅ No"}`,
                `• Hidden Owner: ${hidden_owner === "1" ? "⚠️ Yes" : "✅ No"}`,
                `• Honeypot: ${is_honeypot === "1" ? "🚨 YES" : "✅ No"}`,
            ].join("\n");
            sections.push(securityStatus);

            // Trading Info Section
            const tradingInfo = [
                "💱 Trading Info:",
                `• Buy Tax: ${this.formatTax(buy_tax)}`,
                `• Sell Tax: ${this.formatTax(sell_tax)}`,
            ].join("\n");
            sections.push(tradingInfo);

            // Risk Factors Section
            const risks = [];
            if (is_blacklisted === "1") risks.push("Has blacklist function");
            if (transfer_pausable === "1") risks.push("Trading can be paused");

            if (risks.length > 0) {
                sections.push(`⚠️ Risk Factors:\n• ${risks.join("\n• ")}`);
            }

            // Liquidity Section
            if (contractData.is_in_dex === "1") {
                const liquidityAnalysis = this.analyzeLiquidity(contractData);

                if (liquidityAnalysis.totalLiquidity > 0) {
                    const primaryDex = liquidityAnalysis.dexBreakdown.sort(
                        (a, b) => b.liquidity - a.liquidity
                    )[0];

                    const liquidityInfo = [
                        "💧 Liquidity Analysis:",
                        `• Total Liquidity: $${Math.round(liquidityAnalysis.totalLiquidity).toLocaleString()}`,
                        `• Burned: ${liquidityAnalysis.burnedLiquidity.percentage.toFixed(1)}% ($${Math.round(liquidityAnalysis.burnedLiquidity.amount).toLocaleString()})`,
                        `• Locked: ${liquidityAnalysis.lockedLiquidity.percentage.toFixed(1)}% ($${Math.round(liquidityAnalysis.lockedLiquidity.amount).toLocaleString()})`,
                        `• Primary DEX: ${primaryDex.name} - $${Math.round(primaryDex.liquidity).toLocaleString()} (${primaryDex.percentage.toFixed(1)}%)`,
                    ].join("\n");
                    sections.push(liquidityInfo);

                    // Lock details section
                    if (liquidityAnalysis.lockedLiquidity.details.length > 0) {
                        const lockDetails = ["🔒 Lock Details:"];
                        liquidityAnalysis.lockedLiquidity.details.forEach(
                            (lock) => {
                                const lockInfo = lock.lockDetails?.[0];
                                lockDetails.push(
                                    `• ${lock.address.slice(0, 6)}...${lock.address.slice(-4)}: ${lock.percentage.toFixed(1)}%${
                                        lockInfo
                                            ? `\n  Unlocks: ${new Date(Number(lockInfo.endTime) * 1000).toLocaleDateString()}`
                                            : ""
                                    }`
                                );
                            }
                        );
                        sections.push(lockDetails.join("\n"));
                    }
                }
            } else {
                sections.push("💧 Liquidity: No DEX liquidity found");
            }

            return `${sections.join("\n\n")}\n\n⚠️ DYOR. Not financial advice.`;
        } catch (error) {
            elizaLogger.error("[ContractAnalysis] Failed to format analysis", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                action: "ANALYZE_CONTRACT",
            });
            throw new Error(
                `Failed to format contract analysis: ${error.message}`
            );
        }
    }

    private analyzeLiquidity(contractData: any): LiquidityAnalysis {
        elizaLogger.debug("[ContractAnalysis] Analyzing liquidity data", {
            hasInDex: contractData.is_in_dex === "1",
            action: "ANALYZE_CONTRACT",
        });

        if (contractData.is_in_dex !== "1") {
            return {
                totalLiquidity: 0,
                dexBreakdown: [],
                lockedLiquidity: {
                    amount: 0,
                    percentage: 0,
                    details: [],
                },
                burnedLiquidity: {
                    amount: 0,
                    percentage: 0,
                },
            };
        }

        // Get DEX data
        const dexBreakdown = (contractData.dex || [])
            .map((dex) => ({
                name: dex.name || "Unknown DEX",
                liquidity: Number(dex.liquidity || 0),
                pair: dex.pair || "",
                percentage: 0,
            }))
            .filter((dex) => dex.liquidity > 0);

        const totalLiquidity = dexBreakdown.reduce(
            (sum, dex) => sum + dex.liquidity,
            0
        );

        // Calculate percentages if there's any liquidity
        if (totalLiquidity > 0) {
            dexBreakdown.forEach((dex) => {
                dex.percentage = (dex.liquidity / totalLiquidity) * 100;
            });
        }

        // Analysis of LP holders (if available)
        const lpHolders = contractData.lp_holders || [];
        const lpTotalSupply = Number(contractData.lp_total_supply || 0);

        let burnedAmount = 0;
        let lockedAmount = 0;
        const lockedDetails: any[] = [];

        if (lpHolders.length > 0 && lpTotalSupply > 0) {
            lpHolders.forEach((holder) => {
                const holderAmount = Number(holder.balance || 0);
                const percentage =
                    lpTotalSupply > 0
                        ? (holderAmount / lpTotalSupply) * 100
                        : 0;

                if (DEAD_ADDRESSES.includes(holder.address?.toLowerCase())) {
                    burnedAmount += holderAmount;
                } else if (holder.is_locked === "1") {
                    lockedAmount += holderAmount;
                    lockedDetails.push({
                        address: holder.address,
                        amount: holderAmount,
                        percentage,
                        lockDetails:
                            holder.NFT_list?.map((nft) => ({
                                endTime: nft.end_time,
                                amount: nft.amount,
                            })) || [],
                    });
                }
            });
        }

        return {
            totalLiquidity,
            dexBreakdown,
            lockedLiquidity: {
                amount: lockedAmount,
                percentage:
                    lpTotalSupply > 0
                        ? (lockedAmount / lpTotalSupply) * 100
                        : 0,
                details: lockedDetails,
            },
            burnedLiquidity: {
                amount: burnedAmount,
                percentage:
                    lpTotalSupply > 0
                        ? (burnedAmount / lpTotalSupply) * 100
                        : 0,
            },
        };
    }

    private formatTax(tax: string | undefined): string {
        if (!tax) return "0%";
        const taxNum = Number(tax);
        return isNaN(taxNum) ? "Unknown" : `${(taxNum * 100).toFixed(2)}%`;
    }

    generateAnalysisResponse(safety: ContractAnalysisSummary): string {
        let response = "";
        if (safety.liquidityStatus.hasLiquidity) {
            response += `The contract has $${Math.round(safety.liquidityStatus.totalLiquidity).toLocaleString()} in liquidity. `;
            if (
                safety.liquidityStatus.isLocked ||
                safety.liquidityStatus.isBurned
            ) {
                response +=
                    "The liquidity is " +
                    (safety.liquidityStatus.isLocked ? "locked" : "burned") +
                    ", which is good. ";
            } else {
                response +=
                    "The liquidity is not locked or burned, which is risky. ";
            }
        }

        if (safety.isSafe) {
            response +=
                "\n\nI've analyzed the contract and it appears to be safe. ";
            if (safety.keyPoints.length > 0) {
                response += `Key points: ${safety.keyPoints.join(". ")}.`;
            }
        } else {
            response += `\n\nI've found some concerns with this contract: ${safety.riskFactors.join(", ")}. `;
            if (safety.keyPoints.length > 0) {
                response += `\n\nOther key points: ${safety.keyPoints.join(", ")}.`;
            }
        }

        response +=
            "\n\nIf you'd like to see a detailed breakdown of the contract analysis, just ask.";
        return response;
    }
}
