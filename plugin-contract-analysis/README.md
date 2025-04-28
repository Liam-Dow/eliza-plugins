# @ai16z/plugin-contract-analysis

Smart contract analysis plugin for ElizaOS. Provides comprehensive security analysis for tokens on the Base blockchain by leveraging the GoPlusLabs API, offering your AI agent the ability to inspect smart contracts for security risks, trading constraints, and liquidity information.

## Features
*   **Smart Contract Security Analysis**: Inspects contracts for source code verification, proxy detection, hidden owner functionality, honeypot detection, and mint function analysis.
*   **Trading Information**: Evaluates buy/sell taxes, trading pause mechanisms, blacklist functions, and anti-whale protections.
*   **Liquidity Analysis**: Tracks liquidity across multiple DEXes, verifies liquidity locks, analyzes LP tokens, and monitors token burns.
*   **Caching System**: Efficiently stores analysis results with automatic cleanup to reduce redundant API calls.

## Prerequisites
*   An existing [@ai16z/eliza](https://github.com/elizaOS/eliza) agent setup.
*   GoPlusLabs API access (if required by the implementation).

## Installation & Configuration

1.  **Build the Plugin**: Clone this repository and run the build command:
    ```bash
    git clone https://github.com/Liam-Dow/eliza-plugins contract-analysis-plugin
    cd contract-analysis-plugin
    npm install
    npm run build
    ```
    This will generate the necessary JavaScript files in the `dist/` directory.

2.  **Integrate with Eliza**: 
   
    a. Upload the plugin to the `packages` folder in your Eliza project:
    ```
    packages/
    ├─plugin-contract-analysis/
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    ├── src/
    │   ├── index.ts
    │   ├── types.ts
    │   ├── actions/
    │   │   └── contractAnalysisAction.ts
    │   └── services/
    │       └── contractAnalysisService.ts
    ├── README.md
    └── LICENSE
    ```

    b. Add the plugin to your project's dependencies in the agent's `package.json`:
    ```json
    {
      "dependencies": {
        "@ai16z/plugin-contract-analysis": "workspace:*"
      }
    }
    ```

    c. Import the plugin in your agent's `character.json`:
    ```json
    {
      "plugins": [
        "@ai16z/plugin-contract-analysis",
      ],
    }
    ```

3.  **API Key**: If your implementation requires a GoPlusLabs API key, add it to your `.env` file:
    ```bash
    export GOPLUS_API_KEY='YOUR_API_KEY'
    ```

## Usage

Once installed and configured in your Eliza agent, you can interact with it using natural language or commands:

### Command Format
*   `/scan <contract_address>` - Full contract analysis
*   `/ca <contract_address>` - Quick contract check

## Memory Management

The plugin stores analysis results in Eliza's memory system for efficient retrieval, with automatic cleanup of older analyses. Results are cached for approximately 1 hour by default to minimize redundant API calls while ensuring data remains relatively current.
