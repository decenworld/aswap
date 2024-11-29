import { ethers } from 'ethers';

const TOKEN_LISTS = [
  'https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/joe.tokenlist.json',
  'https://raw.githubusercontent.com/pangolindex/tokenlists/main/pangolin.tokenlist.json',
  'https://raw.githubusercontent.com/0xProject/protocol/development/packages/asset-swapper/src/tokens/avalanche_tokens.json'
];

export interface BaseTokenInfo {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface TokenInfo extends BaseTokenInfo {
  balance?: ethers.BigNumber;
}

export const NATIVE_AVAX: TokenInfo = {
  chainId: 43114,
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  name: 'Avalanche',
  symbol: 'AVAX',
  decimals: 18,
  logoURI: 'https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png'
};

async function fetchTokenMetadata(address: string): Promise<{ name?: string, symbol?: string, logo?: string }> {
  const metadata: { name?: string, symbol?: string, logo?: string } = {};
  
  // Try DexScreener first
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = await response.json();
    if (data.pairs?.[0]) {
      const token = data.pairs[0].baseToken.address.toLowerCase() === address.toLowerCase()
        ? data.pairs[0].baseToken
        : data.pairs[0].quoteToken;
      metadata.name = token.name;
      metadata.symbol = token.symbol;
      if (token.logoURL) metadata.logo = token.logoURL;
    }
  } catch (error) {
    console.error('DexScreener fetch failed:', error);
  }

  // Try CoinGecko
  if (!metadata.logo) {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/avalanche/contract/${address}`);
      const data = await response.json();
      if (data.image?.small) {
        metadata.logo = data.image.small;
      }
    } catch (error) {
      console.error('CoinGecko fetch failed:', error);
    }
  }

  // Try Snowtrace
  if (!metadata.logo) {
    try {
      const response = await fetch(`https://api.snowtrace.io/api?module=token&action=gettoken&contractaddress=${address}`);
      const data = await response.json();
      if (data.result?.[0]?.logo) {
        metadata.logo = data.result[0].logo;
      }
    } catch (error) {
      console.error('Snowtrace fetch failed:', error);
    }
  }

  return metadata;
}

async function getTokenIcon(address: string, name: string, symbol: string): Promise<string | null> {
  // Try to get metadata from various sources
  const metadata = await fetchTokenMetadata(address);
  if (metadata.logo) return metadata.logo;

  // Try common token icon repositories
  const iconSources = [
    `https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/${address}/logo.png`,
    `https://raw.githubusercontent.com/pangolindex/tokens/main/assets/${address}/logo.png`,
    `https://snowtrace.io/token/images/${address}.png`,
    `https://assets.coingecko.com/coins/images/${address}/small/logo.png`,
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanche/assets/${address}/logo.png`,
    `https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/${address.toLowerCase()}/logo.png`,
    // Add dynamic URLs based on token name/symbol
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`,
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${name.toLowerCase()}.png`
  ];

  for (const url of iconSources) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

let tokenList: TokenInfo[] = [];
let isInitialized = false;

export const initializeTokenList = async () => {
  if (isInitialized) return;

  try {
    const lists = await Promise.all(
      TOKEN_LISTS.map(url => 
        fetch(url)
          .then(response => response.json())
          .then(data => data.tokens || data)
          .catch(error => {
            console.error(`Error fetching token list from ${url}:`, error);
            return [];
          })
      )
    );

    // Merge all token lists and remove duplicates
    tokenList = Array.from(
      new Map(
        lists.flat()
          .filter(token => token.chainId === 43114) // Avalanche mainnet
          .map(token => [token.address.toLowerCase(), token])
      ).values()
    );

    isInitialized = true;
  } catch (error) {
    console.error('Error initializing token lists:', error);
  }
};

export const getTokenList = async (
  provider?: ethers.providers.Web3Provider,
  account?: string | null
): Promise<TokenInfo[]> => {
  await initializeTokenList();
  let results: TokenInfo[] = [NATIVE_AVAX, ...tokenList];

  if (provider && account) {
    // Get AVAX balance
    try {
      const avaxBalance = await provider.getBalance(account);
      results[0] = { ...NATIVE_AVAX, balance: avaxBalance };
    } catch (error) {
      console.error('Error fetching AVAX balance:', error);
    }

    // Get token balances
    results = await Promise.all(
      results.map(async (token) => {
        if (token.address === NATIVE_AVAX.address) return token;
        try {
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
          const balance = await contract.balanceOf(account);
          return { ...token, balance };
        } catch (error) {
          return token;
        }
      })
    );
  }

  // Sort tokens: AVAX first, then by balance (non-zero first), then alphabetically
  results.sort((a: TokenInfo, b: TokenInfo) => {
    // AVAX always comes first
    if (a.address === NATIVE_AVAX.address) return -1;
    if (b.address === NATIVE_AVAX.address) return 1;

    // Then sort by balance
    const aHasBalance = a.balance && !a.balance.isZero();
    const bHasBalance = b.balance && !b.balance.isZero();
    
    if (aHasBalance && !bHasBalance) return -1;
    if (!aHasBalance && bHasBalance) return 1;
    if (aHasBalance && bHasBalance && a.balance && b.balance) {
      if (b.balance.gt(a.balance)) return 1;
      if (a.balance.gt(b.balance)) return -1;
    }
    
    // Finally sort by symbol
    return a.symbol.localeCompare(b.symbol);
  });

  return results;
};

export const searchTokens = async (
  query: string,
  provider?: ethers.providers.Web3Provider,
  account?: string | null
): Promise<TokenInfo[]> => {
  const allTokens = await getTokenList(provider, account);
  const searchQuery = query.toLowerCase();

  // If no search query, return all tokens (AVAX will already be at the top)
  if (!searchQuery) {
    return allTokens;
  }

  let results: TokenInfo[] = [];

  // Always include AVAX if it matches the search
  const avax = allTokens[0];
  if (
    avax.symbol.toLowerCase().includes(searchQuery) ||
    avax.name.toLowerCase().includes(searchQuery) ||
    avax.address.toLowerCase().includes(searchQuery)
  ) {
    results.push(avax);
  }

  // Check if it's a valid address
  if (ethers.utils.isAddress(query)) {
    try {
      const token = await importToken(query, provider);
      if (token && !results.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
        results.push(token);
      }
    } catch (error) {
      console.error('Error importing token:', error);
    }
  }

  // Search in existing tokens
  const matchingTokens = allTokens.filter(token => 
    token.address !== NATIVE_AVAX.address && // Skip AVAX as it's handled above
    !results.find(r => r.address.toLowerCase() === token.address.toLowerCase()) && (
      token.symbol.toLowerCase().includes(searchQuery) ||
      token.name.toLowerCase().includes(searchQuery) ||
      token.address.toLowerCase().includes(searchQuery)
    )
  );

  results = [...results, ...matchingTokens];

  return results;
};

export const importToken = async (
  address: string,
  provider?: ethers.providers.Web3Provider
): Promise<TokenInfo | null> => {
  if (!ethers.utils.isAddress(address)) {
    throw new Error('Invalid token address');
  }

  // Check if token is already in the list
  const existingToken = tokenList.find(
    t => t.address.toLowerCase() === address.toLowerCase()
  );
  if (existingToken) {
    return existingToken;
  }

  // If provider is available, try to fetch token info from the contract
  if (provider) {
    try {
      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ]);

      // Get token metadata including icon
      const metadata = await fetchTokenMetadata(address);
      const logoURI = metadata.logo || await getTokenIcon(address, name, symbol);

      const tokenInfo: TokenInfo = {
        chainId: 43114,
        address,
        name: metadata.name || name,
        symbol: metadata.symbol || symbol,
        decimals,
        logoURI: logoURI || undefined
      };

      // Add to token list
      tokenList.push(tokenInfo);
      return tokenInfo;
    } catch (error) {
      console.error('Error importing token:', error);
      return null;
    }
  }

  return null;
};

export const getTokenInfo = async (
  address: string,
  provider?: ethers.providers.Web3Provider
): Promise<TokenInfo | null> => {
  await initializeTokenList();
  
  const token = tokenList.find(
    t => t.address.toLowerCase() === address.toLowerCase()
  );
  
  if (token) {
    return token;
  }

  return importToken(address, provider);
};
