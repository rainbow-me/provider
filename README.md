# Rainbow Provider

[![npm version](https://badge.fury.io/js/@rainbow-me%2Fprovider.svg)](https://www.npmjs.com/package/@rainbow-me/provider)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Ethereum provider implementation used in the Rainbow Extension and Rainbow App Browser.

## Installation

```bash
yarn add @rainbow-me/provider
# or
npm install @rainbow-me/provider
# or
pnpm add @rainbow-me/provider
```

## Usage

```typescript
import { RainbowProvider } from '@rainbow-me/provider';

// Initialize the provider
const provider = new RainbowProvider();

// Use with ethers.js or other web3 libraries
const accounts = await provider.request({
  method: 'eth_accounts',
  params: []
});
```

## Development

```bash
# Install dependencies
yarn install

# Build the package
yarn build

# Run tests
yarn test

# Type check
yarn typecheck

# Lint
yarn lint
```

## License

MIT © Rainbow