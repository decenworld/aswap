// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Interface for DEX router
interface IRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactAVAXForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapExactTokensForAVAX(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract FeeCollector is Ownable, ReentrancyGuard {
    uint256 public constant FEE_PERCENTAGE = 100; // 1% = 100 basis points
    uint256 public constant FEE_DENOMINATOR = 10000; // 100% = 10000
    address public constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address public constant NATIVE_AVAX = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event FeeCollected(address token, uint256 amount);
    event TokensWithdrawn(address token, uint256 amount);
    event AvaxWithdrawn(uint256 amount);

    // Function to handle incoming AVAX
    receive() external payable {}

    // Swap with fee collection in a single transaction
    function swapWithFee(
        address router,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        uint256 deadline
    ) external payable returns (uint[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        
        // Calculate fee and swap amounts
        uint256 feeAmount = (amountIn * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 swapAmount = amountIn - feeAmount;

        // Handle AVAX -> Token swaps
        if (path[0] == NATIVE_AVAX) {
            require(msg.value == amountIn, "Incorrect AVAX amount");
            
            // Create new path replacing NATIVE_AVAX with WAVAX
            address[] memory newPath = new address[](path.length);
            newPath[0] = WAVAX;
            for(uint i = 1; i < path.length; i++) {
                newPath[i] = path[i];
            }
            
            // Forward the swap amount to the router
            amounts = IRouter(router).swapExactAVAXForTokens{value: swapAmount}(
                amountOutMin,
                newPath,
                msg.sender,
                deadline
            );
            
            emit FeeCollected(NATIVE_AVAX, feeAmount);
        } 
        // Handle Token -> AVAX swaps
        else if (path[path.length - 1] == NATIVE_AVAX) {
            // Transfer tokens from sender to this contract
            require(
                IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn),
                "Token transfer failed"
            );
            
            // Create new path replacing NATIVE_AVAX with WAVAX
            address[] memory newPath = new address[](path.length);
            for(uint i = 0; i < path.length - 1; i++) {
                newPath[i] = path[i];
            }
            newPath[path.length - 1] = WAVAX;
            
            // Approve router to spend swap amount
            IERC20(path[0]).approve(router, swapAmount);
            
            // Execute the swap
            amounts = IRouter(router).swapExactTokensForAVAX(
                swapAmount,
                amountOutMin,
                newPath,
                msg.sender,
                deadline
            );
            
            emit FeeCollected(path[0], feeAmount);
        }
        // Handle Token -> Token swaps
        else {
            // Transfer tokens from sender to this contract
            require(
                IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn),
                "Token transfer failed"
            );
            
            // Approve router to spend swap amount
            IERC20(path[0]).approve(router, swapAmount);
            
            // Execute the swap
            amounts = IRouter(router).swapExactTokensForTokens(
                swapAmount,
                amountOutMin,
                path,
                msg.sender,
                deadline
            );
            
            emit FeeCollected(path[0], feeAmount);
        }
        
        return amounts;
    }

    // Withdraw specific token (only owner)
    function withdrawToken(address token, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(
            IERC20(token).transfer(owner(), amount),
            "Token transfer failed"
        );
        emit TokensWithdrawn(token, amount);
    }

    // Withdraw all of a specific token (only owner)
    function withdrawAllToken(address token) external onlyOwner nonReentrant {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(
            IERC20(token).transfer(owner(), balance),
            "Token transfer failed"
        );
        emit TokensWithdrawn(token, balance);
    }

    // Withdraw AVAX (only owner)
    function withdrawAvax(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = owner().call{value: amount}("");
        require(success, "AVAX transfer failed");
        emit AvaxWithdrawn(amount);
    }

    // Withdraw all AVAX (only owner)
    function withdrawAllAvax() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No AVAX to withdraw");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "AVAX transfer failed");
        emit AvaxWithdrawn(balance);
    }
} 