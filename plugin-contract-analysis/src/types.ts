export interface StoredContractAnalysis {
    contractAddress: string;
    rawData: GoPlusLabsResponse["result"][string]; // More specific type
    formattedAnalysis: string;
    safety: ContractAnalysisSummary;
    timestamp: number;
}

export interface ContractAnalysis {
    id: string;
    contract_address: string;
    analysis_result: GoPlusLabsResponse;
    created_at: number;
}

export interface GoPlusContractSecurity {
    is_open_source?: "0" | "1";
    is_proxy?: "0" | "1";
    is_mintable?: "0" | "1";
    owner_address?: string;
    can_take_back_ownership?: "0" | "1";
    owner_change_balance?: "0" | "1";
    hidden_owner?: "0" | "1";
    selfdestruct?: "0" | "1";
    external_call?: "0" | "1";
    gas_abuse?: "0" | "1";
}

export interface GoPlusTradingSecurity {
    is_in_dex?: "0" | "1";
    buy_tax?: string;
    sell_tax?: string;
    cannot_buy?: "0" | "1";
    cannot_sell_all?: "0" | "1";
    slippage_modifiable?: "0" | "1";
    is_honeypot?: "0" | "1";
    transfer_pausable?: "0" | "1";
    is_blacklisted?: "0" | "1";
    is_whitelisted?: "0" | "1";
    is_anti_whale?: "0" | "1";
    anti_whale_modifiable?: "0" | "1";
    trading_cooldown?: "0" | "1";
    personal_slippage_modifiable?: "0" | "1";
    dex?: {
        name: string;
        liquidity: string;
        pair: string;
    }[];
}

export interface GoPlusInfoSecurity {
    token_name?: string;
    token_symbol?: string;
    holder_count?: string;
    total_supply?: string;
    holders?: {
        address: string;
        locked: "0" | "1";
        tag?: string;
        is_contract: "0" | "1";
        balance: string;
        percent: string;
        locked_detail?: {
            amount: string;
            end_time: string;
            opt_time: string;
        }[];
    }[];
    owner_address?: string; // Add this
    owner_balance?: string;
    owner_percent?: string;
    creator_address?: string;
    creator_balance?: string;
    creator_percent?: string;
    is_true_token?: "0" | "1";
    is_airdrop_scam?: "0" | "1";
    trust_list?: "1";
    other_potential_risks?: string;
    note?: string;
}

export interface GoPlusLabsResponse {
    code: number;
    message: string;
    result: {
        [contractAddress: string]: {
            contract_security: GoPlusContractSecurity;
            trading_security: GoPlusTradingSecurity;
            info_security: GoPlusInfoSecurity;
        };
    };
}

export const DEAD_ADDRESSES = [
    "0x000000000000000000000000000000000000dead",
    "0x0000000000000000000000000000000000000000",
];

export interface LiquidityAnalysis {
    totalLiquidity: number;
    dexBreakdown: {
        name: string;
        liquidity: number;
        pair: string;
        percentage: number;
    }[];
    lockedLiquidity: {
        amount: number;
        percentage: number;
        details: {
            address: string;
            amount: number;
            percentage: number;
            lockDetails?: {
                endTime: string;
                amount: string;
            }[];
        }[];
    };
    burnedLiquidity: {
        amount: number;
        percentage: number;
    };
}

export interface ContractAnalysisSummary {
    isSafe: boolean;
    riskFactors: string[];
    keyPoints: string[];
    liquidityStatus: {
        hasLiquidity: boolean;
        totalLiquidity: number;
        isLocked: boolean;
        isBurned: boolean;
    };
}
