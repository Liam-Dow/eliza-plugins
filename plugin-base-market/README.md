# @ai16z/plugin-base-market

Base market data plugin for ElizaOS. Provides a foundation for market data functionality by integrating with APIs such as CoinGecko, allowing your AI agent to fetch and store token information and market data for retrieval in the agent's context window.

## Features
*   **Market Data Integration**: Core functionality for fetching and storing market data from various sources.
*   **Token Information**: Retrieve token metadata and asset information for cryptocurrencies.
*   **Historical Data Storage**: Automatically stores market data in Eliza's database, enabling historical trends analysis.
*   **Extensible Architecture**: Serves as a base for more specific market data plugins like plugin-coingecko.

## Prerequisites
*   An existing [@ai16z/eliza](https://github.com/elizaOS/eliza) agent setup.
*   API keys for any market data sources you plan to use with this plugin.

## Installation & Configuration

1.  **Build the Plugin**: Clone this repository and run the build command:
    ```bash
    git clone https://github.com/Liam-Dow/eliza-plugins base-market-plugin
    cd base-market-plugin
    npm install
    npm run build
    ```
    This will generate the necessary JavaScript files in the `dist/` directory.

2.  **Integrate with Eliza**: 
   
    a. Upload the plugin to the `packages` folder in your Eliza project:
    ```
    packages/
    ├─plugin-base-market/
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    ├── src/
    │   ├── index.ts
    │   ├── schema.ts
    │   ├── tokenInfoSchema.ts
    │   ├── types.ts
    │   ├── providers/
    │   │   └── marketDataProvider.ts
    │   └── services/
    │       ├── marketDataService.ts
    │       └── tokenInfoService.ts
    ├── README.md
    └── LICENSE
    ```

    b. Add the plugin to your project's dependencies in the agent's `package.json`:
    ```json
    {
      "dependencies": {
        "@ai16z/plugin-base-market": "workspace:*"
      }
    }
    ```

    c. Import the plugin in your agent's `character.json`:
    ```json
    {
      "plugins": [
        "@ai16z/plugin-base-market",
      ],
    }
    ```

3.  **Environment Variables**: Configure any required API keys in your `.env` file, depending on which market data providers you intend to use.

4.  **Database Path**: The plugin uses the `@ai16z/adapter-marketdatabase` for data storage. By default, it creates a database in the agent's working directory. You can configure the database path using the `MARKET_DB_PATH` environment variable.

## Usage

This plugin provides core functionality but typically requires extending (as in `plugin-coingecko`) to implement specific API interactions. It can be used in conjunction with more specialized market data plugins for a complete market data solution.

The plugin uses the `@ai16z/adapter-marketdatabase` to store and retrieve market data efficiently.
