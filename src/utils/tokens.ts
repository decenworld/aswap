import { PublicClient } from 'wagmi';
import { 
  formatUnits, 
  parseUnits,
  type Address,
  ContractFunctionExecutionError,
} from 'viem';
import { TokenInfo, NATIVE_AVAX } from './tokenLists';
import { ethers } from 'ethers';

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
}

const COMMON_TOKENS: Address[] = [
  '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
  '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', // WETH.e
  '0x50b7545627a5162F82A992c33b87aDc75187B218', // WBTC.e
  '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', // USDT.e
  '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', // USDC.e
  '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', // DAI.e
];

export const getTokenBalances = async (
  publicClient: PublicClient,
  address?: string
): Promise<TokenBalance[]> => {
  if (!address || !publicClient) return [];
  
  const balances: TokenBalance[] = [];
  const userAddress = address as Address;
  const maxRetries = 3;
  let retryCount = 0;

  const fetchBalances = async () => {
    try {
      // Get native AVAX balance
      const nativeBalance = await publicClient.request({
        method: 'eth_getBalance',
        params: [userAddress, 'latest'],
      });
      
      balances.push({
        token: NATIVE_AVAX,
        balance: formatUnits(BigInt(nativeBalance), NATIVE_AVAX.decimals)
      });

      // Get token balances with retry logic for each token
      for (const tokenAddress of COMMON_TOKENS) {
        let tokenRetries = 0;
        while (tokenRetries < maxRetries) {
          try {
            const [balanceResult, decimalsResult, symbolResult, nameResult] = await Promise.all([
              publicClient.request({
                method: 'eth_call',
                params: [{
                  to: tokenAddress,
                  data: `0x70a08231000000000000000000000000${userAddress.slice(2)}`, // balanceOf
                }, 'latest'],
              }),
              publicClient.request({
                method: 'eth_call',
                params: [{
                  to: tokenAddress,
                  data: '0x313ce567', // decimals
                }, 'latest'],
              }),
              publicClient.request({
                method: 'eth_call',
                params: [{
                  to: tokenAddress,
                  data: '0x95d89b41', // symbol
                }, 'latest'],
              }),
              publicClient.request({
                method: 'eth_call',
                params: [{
                  to: tokenAddress,
                  data: '0x06fdde03', // name
                }, 'latest'],
              }),
            ]);

            const balance = BigInt(balanceResult);
            const decimals = Number(BigInt(decimalsResult));
            const symbol = decodeString(symbolResult);
            const name = decodeString(nameResult);

            balances.push({
              token: {
                address: tokenAddress,
                decimals,
                name,
                symbol,
                logoURI: '', // You can add logo URLs from your token list
              },
              balance: formatUnits(balance, decimals)
            });
            
            break; // Success, exit retry loop
          } catch (error) {
            tokenRetries++;
            if (tokenRetries === maxRetries) {
              console.error(`Failed to fetch balance for token ${tokenAddress} after ${maxRetries} retries:`, error);
            } else {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Error in fetchBalances:', error);
      return false;
    }
  };

  // Main retry loop
  while (retryCount < maxRetries) {
    const success = await fetchBalances();
    if (success) break;
    
    retryCount++;
    if (retryCount < maxRetries) {
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return balances;
};

// Helper function to decode string from contract response
function decodeString(hexString: string): string {
  if (hexString === '0x' || hexString.length < 66) return '';
  
  // Remove '0x' prefix and the first 64 characters (method ID + offset)
  const hex = hexString.slice(66);
  
  // Convert hex to string
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substr(i, 2), 16);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str;
}

export const formatTokenAmount = (amount: string, decimals: number): string => {
  try {
    return ethers.utils.formatUnits(amount, decimals);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
};

export const parseTokenAmount = (amount: string, decimals: number): string => {
  try {
    return parseUnits(amount, decimals).toString();
  } catch (error) {
    console.error('Error parsing token amount:', error);
    return '0';
  }
};
