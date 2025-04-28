import {
    Action,
    IAgentRuntime,
    Memory,
    HandlerCallback,
    ServiceType,
    State,
    elizaLogger,
} from "@ai16z/eliza";
import { ContractAnalysisService } from "../services/contractAnalysisService";

export const analyzeContractAction: Action = {
    name: "ANALYZE_CONTRACT",
    similes: ["check contract", "scan contract", "analyze contract"],
    description: "Analyzes a Base chain contract using GoPlusLabs API",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        const hasContractAddress = /(0x[a-fA-F0-9]{40})/i.test(text);
        const hasAnalyzeIntent =
            text.includes("scan") ||
            text.includes("check") ||
            text.includes("analyze") ||
            text.startsWith("/ca") ||
            text.startsWith("/scan");

        return hasContractAddress && hasAnalyzeIntent;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            const analysisService = runtime.getService<ContractAnalysisService>(
                ServiceType.CONTRACT_ANALYSIS
            );

            if (!analysisService) {
                throw new Error("Contract analysis service not available");
            }

            const match = message.content.text.match(/(0x[a-fA-F0-9]{40})/i);
            if (!match) {
                return false;
            }

            const contractAddress = match[1].toLowerCase();
            const analysisData =
                await analysisService.analyzeContract(contractAddress);

            if (!analysisData?.result?.[contractAddress]) {
                return false;
            }

            const contractData = analysisData.result[contractAddress];
            const { safety, formattedAnalysis } =
                await analysisService.formatAnalysisData(
                    contractData,
                    contractAddress
                );

            await analysisService.storeAnalysis(
                {
                    contractAddress,
                    rawData: contractData,
                    formattedAnalysis,
                    safety,
                    timestamp: Date.now(),
                },
                message.roomId
            );

            if (callback) {
                await callback(
                    {
                        text: formattedAnalysis,
                        data: {
                            safety,
                            analysis: formattedAnalysis,
                            contractAddress,
                        },
                    },
                    []
                );
                return true;
            }

            return false;
        } catch (error) {
            elizaLogger.error("[ContractAnalysis] Analysis failed", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                action: "ANALYZE_CONTRACT",
            });
            return false;
        }
    }
};
