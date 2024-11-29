import { ethers } from 'ethers';
import { TOP_AVALANCHE_TOKENS } from '../constants/tokens';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  balance: ethers.BigNumber;
  decimals: number;
  logoURI?: string;
}

export const getTokenBalances = async (
  provider: ethers.providers.Web3Provider,
  account: string
): Promise<TokenBalance[]> => {
  const balances: TokenBalance[] = [];

  // Get native AVAX balance
  const avaxBalance = await provider.getBalance(account);
  balances.push({
    ...TOP_AVALANCHE_TOKENS[0],
    balance: avaxBalance
  });

  // Get ERC20 token balances
  for (const token of TOP_AVALANCHE_TOKENS.slice(1)) {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance = await contract.balanceOf(account);
      
      if (balance.gt(0)) {
        balances.push({
          ...token,
          balance
        });
      }
    } catch (error) {
      console.error(`Error fetching balance for ${token.symbol}:`, error);
    }
  }

  return balances;
};

export const checkTokenAllowance = async (
  provider: ethers.providers.Web3Provider,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<ethers.BigNumber> => {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return contract.allowance(ownerAddress, spenderAddress);
};

export const approveToken = async (
  provider: ethers.providers.Web3Provider,
  tokenAddress: string,
  spenderAddress: string,
  amount: ethers.BigNumber
): Promise<ethers.ContractTransaction> => {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  
  try {
    const tx = await contract.approve(spenderAddress, amount, {
      gasLimit: 100000 // Add explicit gas limit
    });
    return tx;
  } catch (error: any) {
    console.error('Approval error:', error);
    throw new Error(error.message || 'Token approval failed');
  }
};

export const formatTokenAmount = (amount: ethers.BigNumber, decimals: number): string => {
  return ethers.utils.formatUnits(amount, decimals);
};

export const parseTokenAmount = (amount: string, decimals: number): ethers.BigNumber => {
  return ethers.utils.parseUnits(amount, decimals);
};
