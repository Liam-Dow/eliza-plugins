# @ai16z/plugin-coingecko

Coingecko API plugin for ElizaOS. Easily give your AI agent broad and up-to-date market knowledege and store market history for future retrieval to insert into the agents context window.

## Features
*   **CoinGecko API Integration**: Uses the public CoinGecko API to fetch up-to-date market data.
*   **Get Crypto Prices & Stats**: Ask the agent for the current price, market cap, 24h volume, or 24h change for specific cryptocurrencies.
*   **Get Trending Coins**: Ask the agent about currently trending or popular cryptocurrencies.
*   **Automatic Market Data Updates**: Fetches and stores cryptocurrency market data hourly, maintaining a local database that's automatically cleaned after 30 days.

## Prerequisites
*   An existing [@ai16z/eliza](https://github.com/elizaOS/eliza) agent setup.
*   Coingecko API key

## Installation & Configuration

1.  **Build the Plugin**: Clone this repository and run the build command:
    ```bash
    git clone https://github.com/Liam-Dow/eliza-plugins coingecko-plugin
    cd coingecko-plugin
    npm install
    npm run build
    ```
    This will generate the necessary JavaScript files in the `dist/` directory.

2.  **Integrate with Eliza**: 
   
    a. Upload the plugin to the `packages` folder in your Eliza project:
    ```
    packages/
    ├─plugin-coingecko/
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    ├── src/
    │   ├── index.ts
    │   ├── types.ts
    │   ├── actions/
    │   │   ├── getPriceAction.ts
    │   │   └── getTrendingAction.ts
    │   ├── providers/
    │   │   └── cryptoProvider.ts
    │   └── services/
    │       ├── coingeckoService.ts
    │       └── marketDataService.ts
    ├── README.md
    └── LICENSE
    ```

    b. Add the plugin to your project's dependencies in the agent's `package.json`:
    ```json
    {
      "dependencies": {
        "@ai16z/plugin-coingecko": "workspace:*"
      }
    }
    ```

    c. Import the plugin in your agent's `character.json`:
    ```json
    {
      "plugins": [
        "@ai16z/plugin-coingecko",
      ],
    }
    ```

3.  **API Key**: Obtain an API key from [CoinGecko](https://www.coingecko.com/en/api) and add it to your .env:
    ```bash
    export COINGECKO_API_KEY='YOUR_API_KEY'
    ```

4.  **Database Path**: The plugin uses a custom database adapter `@ai16z/adapter-marketdatabase`. By default, it creates `data/market.db` in the agent's working directory. You can override this by setting the `MARKET_DB_PATH` environment variable.
