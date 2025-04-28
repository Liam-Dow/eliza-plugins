# @ai16z/adapter-marketdatabase

Market database adapter for ElizaOS. Provides efficient storage and retrieval of cryptocurrency market data with optimized SQLite persistence, enabling plugins to store historical price data, track market trends, and analyze token performance.

## Features
*   **Optimized SQLite Storage**: Uses better-sqlite3 with WAL journal mode and performance optimizations.
*   **Market Data Management**: Store and retrieve cryptocurrency market data including prices, volumes, and market caps.
*   **Category System**: Organize tokens into categories (e.g., "Base Ecosystem", "DeFi") for easier analysis.
*   **Market Analysis**: Generate insights on volume leaders and price movers across different timeframes.
*   **Automatic Data Cleanup**: Configurable retention policy to manage database size.

## Prerequisites
*   An existing [@ai16z/eliza](https://github.com/elizaOS/eliza) agent setup.
*   SQLite3 support on your system.

## Installation & Configuration

1.  **Build the Adapter**: Clone this repository and run the build command:
    ```bash
    git clone https://github.com/Liam-Dow/eliza-plugins adapter-marketdatabase
    cd adapter-marketdatabase
    npm install
    npm run build
    ```
    This will generate the necessary JavaScript files in the `dist/` directory.

2.  **Integrate with Eliza**: 
   
    a. Upload the adapter to the `packages` folder in your Eliza project:
    ```
    packages/
    ├─adapter-marketdatabase/
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    ├── schema.sql
    ├── src/
    │   ├── index.ts
    │   ├── MarketDatabaseAdapter.ts
    │   └── types.ts
    ├── README.md
    └── LICENSE
    ```

    b. Add the adapter to your project's dependencies in the agent's `package.json`:
    ```json
    {
      "dependencies": {
        "@ai16z/adapter-marketdatabase": "workspace:*"
      }
    }
    ```

3.  **Environment Variables**: Configure the database path in your `.env` file (optional):
    ```bash
    export MARKET_DB_PATH='path/to/your/market.db'
    ```
    If not specified, the database will be created in the default location `data/market.db`.

## Integration with Plugins

This adapter is designed to work with market data plugins like:

* [@ai16z/plugin-base-market](../plugin-base-market/README.md): Uses this adapter for core market data storage.
* [@ai16z/plugin-coingecko](../plugin-coingecko/README.md): Extends the base market plugin with CoinGecko API integration.
