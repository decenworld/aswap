import { ethers } from 'ethers';

// Complete DEX Router ABIs with proper function signatures
export const DEX_ROUTERS = {
  TRADER_JOE: {
    address: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
    abi: [
      'function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)',
      'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
      'function swapExactAVAXForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)',
      'function swapExactTokensForAVAX(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
      'function WAVAX() external pure returns (address)'
    ]
  },
  PANGOLIN: {
    address: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
    abi: [
      'function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)',
      'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
      'function swapExactAVAXForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)',
      'function swapExactTokensForAVAX(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
      'function WAVAX() external pure returns (address)'
    ]
  },
  GMX: {
    address: '0x5F719c2F1095F7B9fc68a68e35B51194f4b6abe8',
    abi: [
      'function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)',
      'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
      'function swapExactAVAXForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts)',
      'function swapExactTokensForAVAX(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
      'function WAVAX() external pure returns (address)'
    ]
  }
};

const WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const NATIVE_AVAX = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export interface Route {
  dex: string;
  outputAmount: ethers.BigNumber;
  path: string[];
  routerAddress: string;
}

export const getBestRoute = async (
  provider: ethers.providers.Web3Provider,
  fromToken: string,
  toToken: string,
  amountIn: string
): Promise<Route> => {
  const routes: Route[] = [];
  
  const actualFromToken = fromToken === NATIVE_AVAX ? WAVAX : fromToken;
  const actualToToken = toToken === NATIVE_AVAX ? WAVAX : toToken;

  for (const [dexName, dexInfo] of Object.entries(DEX_ROUTERS)) {
    try {
      const router = new ethers.Contract(dexInfo.address, dexInfo.abi, provider);
      const path = [actualFromToken, actualToToken];
      
      if (actualFromToken !== WAVAX && actualToToken !== WAVAX && actualFromToken !== actualToToken) {
        path.splice(1, 0, WAVAX);
      }

      const amounts = await router.getAmountsOut(amountIn, path);
      
      routes.push({
        dex: dexName,
        outputAmount: amounts[amounts.length - 1],
        path,
        routerAddress: dexInfo.address
      });
    } catch (error) {
      console.error(`Error fetching route from ${dexName}:`, error);
    }
  }

  if (routes.length === 0) {
    throw new Error('No valid routes found');
  }

  routes.sort((a, b) => (b.outputAmount.gt(a.outputAmount) ? 1 : -1));
  return routes[0];
};

export const executeSwap = async (
  provider: ethers.providers.Web3Provider,
  route: Route,
  fromToken: string,
  toToken: string,
  amountIn: string,
  slippage: number = 0.5 // 0.5% default slippage
) => {
  const signer = provider.getSigner();
  const dexInfo = DEX_ROUTERS[route.dex as keyof typeof DEX_ROUTERS];
  const router = new ethers.Contract(dexInfo.address, dexInfo.abi, signer);
  const to = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minute deadline

  // Calculate minimum amount out with slippage
  const minAmountOut = route.outputAmount.mul(1000 - Math.floor(slippage * 10)).div(1000);

  try {
    let tx;
    if (fromToken === NATIVE_AVAX) {
      tx = await router.swapExactAVAXForTokens(
        minAmountOut,
        route.path,
        to,
        deadline,
        { value: amountIn, gasLimit: 300000 }
      );
    } else if (toToken === NATIVE_AVAX) {
      tx = await router.swapExactTokensForAVAX(
        amountIn,
        minAmountOut,
        route.path,
        to,
        deadline,
        { gasLimit: 300000 }
      );
    } else {
      tx = await router.swapExactTokensForTokens(
        amountIn,
        minAmountOut,
        route.path,
        to,
        deadline,
        { gasLimit: 300000 }
      );
    }

    return tx;
  } catch (error: any) {
    console.error('Swap error:', error);
    throw new Error(error.message || 'Swap failed');
  }
};
