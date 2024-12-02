import { PublicClient } from 'wagmi';
import { ethers } from 'ethers';

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
}

const TOKEN_LISTS = [
  'https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/joe.tokenlist.json',
  'https://raw.githubusercontent.com/pangolindex/tokenlists/main/pangolin.tokenlist.json'
];

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

export const NATIVE_AVAX: TokenInfo = {
  address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  name: 'Avalanche',
  symbol: 'AVAX',
  decimals: 18,
  logoURI: 'https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png'
};

let tokenList: TokenInfo[] = [];
let isInitialized = false;

async function fetchTokenFromDexScreener(address: string): Promise<TokenInfo | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const token = data.pairs[0].baseToken.address.toLowerCase() === address.toLowerCase() 
        ? data.pairs[0].baseToken 
        : data.pairs[0].quoteToken;

      return {
        address: address,
        name: token.name,
        symbol: token.symbol,
        decimals: 18, // Default to 18, will be updated from contract
        logoURI: `https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/${address}/logo.png`
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching from DexScreener:', error);
    return null;
  }
}

async function fetchTokenFromContract(address: string, provider: any): Promise<TokenInfo | null> {
  try {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals()
    ]);

    return {
      address,
      name,
      symbol,
      decimals,
      logoURI: `https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/${address}/logo.png`
    };
  } catch (error) {
    console.error('Error fetching from contract:', error);
    return null;
  }
}

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

    tokenList = Array.from(
      new Map(
        lists.flat()
          .filter(token => token.chainId === 43114)
          .map(token => [token.address.toLowerCase(), token])
      ).values()
    );

    isInitialized = true;
  } catch (error) {
    console.error('Error initializing token lists:', error);
  }
};

async function getTokenBalance(tokenAddress: string, userAddress: string, provider: any): Promise<string> {
  try {
    if (tokenAddress === NATIVE_AVAX.address) {
      const balance = await provider.getBalance(userAddress);
      return balance.toString();
    }

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    return balance.toString();
  } catch (error) {
    console.error(`Error getting balance for token ${tokenAddress}:`, error);
    return '0';
  }
}

export const getTokenList = async (
  publicClient: PublicClient,
  address?: string
): Promise<TokenInfo[]> => {
  await initializeTokenList();
  let results = [NATIVE_AVAX, ...tokenList];

  if (address && window.ethereum) {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const balancePromises = results.map(async (token) => {
      const balance = await getTokenBalance(token.address, address, provider);
      return {
        ...token,
        balance
      };
    });

    results = await Promise.all(balancePromises);
  }

  results.sort((a, b) => {
    if (a.address === NATIVE_AVAX.address) return -1;
    if (b.address === NATIVE_AVAX.address) return 1;

    const aBalance = a.balance ? parseFloat(ethers.utils.formatUnits(a.balance, a.decimals)) : 0;
    const bBalance = b.balance ? parseFloat(ethers.utils.formatUnits(b.balance, b.decimals)) : 0;

    if (aBalance !== bBalance) {
      return bBalance - aBalance;
    }

    return a.symbol.localeCompare(b.symbol);
  });

  return results;
};

export const searchTokens = async (
  query: string,
  publicClient: PublicClient,
  address?: string
): Promise<TokenInfo[]> => {
  const searchQuery = query.toLowerCase();
  let allTokens = await getTokenList(publicClient, address);

  // Check if query is an address
  if (ethers.utils.isAddress(query)) {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const tokenFromList = allTokens.find(t => t.address.toLowerCase() === query.toLowerCase());
    
    if (!tokenFromList) {
      // Try DexScreener first
      let newToken = await fetchTokenFromDexScreener(query);
      
      // If not found on DexScreener, try contract directly
      if (!newToken) {
        newToken = await fetchTokenFromContract(query, provider);
      }

      // If token found, add balance if address available
      if (newToken && address) {
        const balance = await getTokenBalance(newToken.address, address, provider);
        newToken.balance = balance;
        allTokens = [newToken, ...allTokens];
      }
    }
  }

  // Filter tokens based on search
  return allTokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery) ||
    token.name.toLowerCase().includes(searchQuery) ||
    token.address.toLowerCase().includes(searchQuery)
  );
};
