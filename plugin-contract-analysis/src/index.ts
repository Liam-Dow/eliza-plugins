import { Plugin } from "@ai16z/eliza";
import { ContractAnalysisService } from "./services/contractAnalysisService";
import { analyzeContractAction } from "./actions/contractAnalysisAction";

export const contractAnalysisPlugin: Plugin = {
    name: "contract-analysis",
    description:
        "Analyzes Base chain contracts for security, trading data, and ownership information",
    actions: [analyzeContractAction],
    services: [new ContractAnalysisService()],
};

export * from "./types";
export * from "./services/contractAnalysisService";
