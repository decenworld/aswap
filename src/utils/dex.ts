import { ethers } from 'ethers';
import { Address } from 'viem';
import { formatTokenAmount } from './tokens';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// Constants
export const WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
export const NATIVE_AVAX = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// ERC20 ABI for token decimals
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactAVAXForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForAVAX(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
];

// Define DEX names type
export type DexName = 'traderjoe' | 'pangolin';

export const DEX_NAMES: DexName[] = ['traderjoe', 'pangolin'];

export const DEX_ROUTERS: Record<DexName, { address: string; abi: string[] }> = {
  'traderjoe': {
    address: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
    abi: ROUTER_ABI
  },
  'pangolin': {
    address: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
    abi: ROUTER_ABI
  }
};

export interface Route {
  dex: DexName;
  routerAddress: string;
  outputAmount: ethers.BigNumber;
  priceUSD: string;
  priceImpact: string;
  path: string[];
  data?: string;
  value?: string;
}

// Cache for token decimals
const tokenDecimalsCache: { [address: string]: number } = {
  [WAVAX.toLowerCase()]: 18,
  [NATIVE_AVAX.toLowerCase()]: 18,
};

async function getTokenDecimals(tokenAddress: string, provider: ethers.providers.Provider): Promise<number> {
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Return from cache if available
  if (tokenDecimalsCache[normalizedAddress]) {
    return tokenDecimalsCache[normalizedAddress];
  }

  // For native AVAX, return 18
  if (normalizedAddress === NATIVE_AVAX.toLowerCase()) {
    return 18;
  }

  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await tokenContract.decimals();
    tokenDecimalsCache[normalizedAddress] = decimals;
    return decimals;
  } catch (error) {
    console.error('Error getting token decimals:', error);
    return 18; // Default to 18 decimals
  }
}

// Token prices for USD calculation (replace with real API later)
const TOKEN_PRICES: Record<string, number> = {
  [WAVAX.toLowerCase()]: 35,
  [NATIVE_AVAX.toLowerCase()]: 35,
  ['0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'.toLowerCase()]: 1, // USDC
  ['0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'.toLowerCase()]: 1, // USDT
  ['0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB'.toLowerCase()]: 2200, // WETH
  ['0x50b7545627a5162F82A992c33b87aDc75187B218'.toLowerCase()]: 43000, // WBTC
};

async function getTokenPrice(tokenAddress: string): Promise<number> {
  const lowerAddress = tokenAddress.toLowerCase();
  if (lowerAddress === NATIVE_AVAX.toLowerCase()) {
    return TOKEN_PRICES[WAVAX.toLowerCase()] || 0;
  }
  return TOKEN_PRICES[lowerAddress] || 0;
}

async function calculateUSDValue(amount: string, tokenAddress: string, decimals: number): Promise<string> {
  const tokenPrice = await getTokenPrice(tokenAddress);
  const tokenAmount = parseFloat(ethers.utils.formatUnits(amount, decimals));
  const usdValue = tokenAmount * tokenPrice;
  return usdValue.toFixed(2);
}

interface QuoteResult {
  amountOut: ethers.BigNumber;
  priceImpact: string;
  route: string[];
  toDecimals: number;
  usdValue: string;
}

// Get real quote from DEX router contract
async function getDexQuote(
  dex: DexName,
  fromToken: string,
  toToken: string,
  amountIn: string
): Promise<QuoteResult> {
  console.log(`Getting quote for ${dex}:`, {
    fromToken,
    toToken,
    amountIn
  });

  // Skip if amount is 0
  if (amountIn === '0' || !amountIn) {
    return {
      amountOut: ethers.BigNumber.from(0),
      priceImpact: '0',
      route: [fromToken, toToken],
      toDecimals: 18,
      usdValue: '0'
    };
  }

  try {
    // Handle NATIVE_AVAX to WAVAX conversion for router calls
    const fromTokenAddress = fromToken === NATIVE_AVAX ? WAVAX : fromToken;
    const toTokenAddress = toToken === NATIVE_AVAX ? WAVAX : toToken;

    // Get router info
    const routerInfo = DEX_ROUTERS[dex];
    if (!routerInfo) {
      throw new Error(`Router not found for ${dex}`);
    }

    // Create provider and contract instance
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const routerContract = new ethers.Contract(
      routerInfo.address,
      routerInfo.abi,
      provider
    );

    // Get token decimals
    const [fromDecimals, toDecimals] = await Promise.all([
      getTokenDecimals(fromTokenAddress, provider),
      getTokenDecimals(toTokenAddress, provider),
    ]);

    // Parse input amount with proper decimals
    const parsedAmountIn = ethers.utils.parseUnits(
      ethers.utils.formatUnits(amountIn, fromDecimals),
      fromDecimals
    );

    // Get amounts out from router
    const path = [fromTokenAddress, toTokenAddress];
    const amounts = await routerContract.getAmountsOut(parsedAmountIn, path);
    const outputAmount = amounts[amounts.length - 1];

    // Calculate USD value using the output amount
    const usdValue = await calculateUSDValue(outputAmount.toString(), toTokenAddress, toDecimals);

    // Calculate price impact
    const priceImpact = ethers.BigNumber.from(1000)
      .sub(outputAmount.mul(1000).div(parsedAmountIn))
      .toString();

    return {
      amountOut: outputAmount,
      priceImpact,
      route: path,
      toDecimals,
      usdValue
    };
  } catch (error) {
    console.error(`Error getting quote from ${dex}:`, error);
    return {
      amountOut: ethers.BigNumber.from(0),
      priceImpact: '0',
      route: [fromToken, toToken],
      toDecimals: 18,
      usdValue: '0'
    };
  }
}

export const getAllRoutes = async (
  fromToken: string,
  toToken: string,
  amountIn: string
): Promise<Route[]> => {
  console.log('Getting all routes:', {
    fromToken,
    toToken,
    amountIn
  });

  // Return empty routes if amount is 0 or tokens are the same
  if (amountIn === '0' || !amountIn || fromToken === toToken) {
    return [];
  }

  const routes: Route[] = [];
  
  try {
    // Get quotes from different DEXes
    for (const dexName of DEX_NAMES) {
      try {
        const quote = await getDexQuote(dexName, fromToken, toToken, amountIn);
        
        // Skip if no valid quote received
        if (quote.amountOut.eq(0)) {
          console.log(`Skipping ${dexName} - zero output amount`);
          continue;
        }

        const route: Route = {
          dex: dexName,
          outputAmount: quote.amountOut,
          path: quote.route,
          routerAddress: DEX_ROUTERS[dexName].address,
          priceUSD: quote.usdValue,
          priceImpact: (parseFloat(quote.priceImpact) / 10).toFixed(2)
        };

        console.log(`Adding route for ${dexName}:`, route);
        routes.push(route);
      } catch (error) {
        console.error(`Error fetching ${dexName} quote:`, error);
      }
    }

    // Sort routes by output amount (best first)
    routes.sort((a, b) => (b.outputAmount.gt(a.outputAmount) ? 1 : -1));
    console.log('Final sorted routes:', routes);
  } catch (error) {
    console.error('Error getting routes:', error);
  }

  return routes;
};

// Add FeeCollector ABI and address
const FEE_COLLECTOR_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
const FEE_COLLECTOR_ABI = [
  'function collectFee(address token, uint256 amount) external returns (uint256)',
];

export const executeSwap = async (
  route: Route,
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string,
  slippage: number,
  options?: { value?: ethers.BigNumber }
): Promise<ethers.ContractTransaction> => {
  if (!window.ethereum) {
    throw new Error('No Web3 provider found');
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const userAddress = await signer.getAddress();

  // Create router contract instance
  const routerContract = new ethers.Contract(
    route.routerAddress,
    [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactAVAXForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForAVAX(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ],
    signer
  );

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now
  
  // Get token decimals
  const decimals = fromTokenAddress === 'AVAX' ? 18 : 18; // Default to 18 for now, should get from token contract
  const parsedAmount = ethers.utils.parseUnits(amount, decimals);
  
  // Calculate minimum amount out with slippage
  const minAmountOut = route.outputAmount.mul(100 - Math.floor(slippage * 100)).div(100);

  console.log('Swap parameters:', {
    parsedAmount: parsedAmount.toString(),
    minAmountOut: minAmountOut.toString(),
    path: route.path,
    deadline,
    value: options?.value?.toString()
  });

  let tx: ethers.ContractTransaction;

  try {
    // Execute the swap based on token types
    if (fromTokenAddress === 'AVAX') {
      tx = await routerContract.swapExactAVAXForTokens(
        minAmountOut,
        route.path,
        userAddress,
        deadline,
        { 
          ...options,
          gasLimit: 300000
        }
      );
    } else if (toTokenAddress === 'AVAX') {
      tx = await routerContract.swapExactTokensForAVAX(
        parsedAmount,
        minAmountOut,
        route.path,
        userAddress,
        deadline,
        { gasLimit: 300000 }
      );
    } else {
      tx = await routerContract.swapExactTokensForTokens(
        parsedAmount,
        minAmountOut,
        route.path,
        userAddress,
        deadline,
        { gasLimit: 300000 }
      );
    }

    return tx;
  } catch (error: any) {
    console.error('Swap execution error:', error);
    throw new Error(error.message || 'Swap failed');
  }
};
