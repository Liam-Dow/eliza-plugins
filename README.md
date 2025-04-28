# Eliza OS Plugins and Adapters

A collection of custom plugins and adapters for [ElizaOS](https://github.com/elizaOS/eliza) that extend your AI agent with additional capabilities. This repository includes tools for market data management, cryptocurrency information, and blockchain contract analysis.

## Available Components

### Plugins

#### [@ai16z/plugin-base-market](./plugin-base-market/README.md)

Base market data plugin that provides a foundation for market data functionality. This plugin offers core services for fetching and storing token information and market data from various sources.

#### [@ai16z/plugin-coingecko](./plugin-coingecko/README.md)

CoinGecko API integration plugin that enables your AI agent to fetch real-time cryptocurrency prices, stats, and trending coins. This plugin builds on the base-market plugin to provide specific CoinGecko functionality.

#### [@ai16z/plugin-contract-analysis](./plugin-contract-analysis/README.md)

Smart contract analysis plugin for tokens on the Base blockchain. Using the GoPlusLabs API, this plugin offers detailed security analysis, trading information, and liquidity data for any given contract address.

### Adapters

#### [@ai16z/adapter-marketdatabase](./adapter-marketdatabase/README.md)

SQLite database adapter optimized for storing and retrieving cryptocurrency market data. This adapter provides efficient persistence for historical price data, market trends, and token categorization, supporting the market-related plugins.

## Getting Started

Each component has its own README with detailed installation and usage instructions. Click on the links above to learn more about each specific plugin or adapter.

To use these components, you'll need an existing ElizaOS agent setup. Follow the individual instructions to add them to your agent's configuration.

## Common Installation Steps

While each component has specific requirements, most follow this general installation pattern:

1. Clone the repository
2. Install dependencies and build
3. Add to your `packages` folder in your Eliza project
4. Include in your agent's configuration
5. Configure any necessary API keys via environment variables

Refer to each component's README for specific installation and configuration details.
