//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./PriceConsumerV3.sol";
import "./SellLimitter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

contract PegDex is PriceConsumerV3, Ownable, ReentrancyGuard, SellLimitter {
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20Metadata; 

    IUniswapV2Router02 private router;
    IERC20Metadata public copToken;
    IERC20Metadata public usdToken;
    IERC20 public wbtcToken;
    uint16 public fee;
    address public WETH;
    int256 public artificialPrice;
    uint256 public slotAmount;
    uint256 public slotAvailable;
    uint256 public slotMinimum;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "PegDex: DEADLINE_EXPIRED");
        _;
    }


    constructor(
        IERC20Metadata _cop,
        IERC20Metadata _usd,
        address _usdCopFeed,
        IERC20 _wbtc,
        IUniswapV2Router02 _router,
        uint16 _fee,
        uint256 _daysInSellPeriod,
        uint256 _periodSellLimit
    ) PriceConsumerV3(_usdCopFeed) {
        copToken = _cop;
        usdToken = _usd;
        wbtcToken = _wbtc;
        router = _router;
        fee = _fee;
        WETH = router.WETH();
        daysInSellPeriod = _daysInSellPeriod;
        periodSellLimit = _periodSellLimit;
        slotAmount = 0;
    }

    event Swapped(
        address sender,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );

    function wBTCToUSD(uint256 wBTCAmount) private view returns (uint256) {
        return
            amountOutFromRouter(
                address(wbtcToken),
                wBTCAmount,
                address(usdToken)
            );
    }

    function usdToWBTC(uint256 usdAmount) private view returns (uint256) {
        return
            amountOutFromRouter(
                address(usdToken),
                usdAmount,
                address(wbtcToken)
            );
    }

    function amountOutFromRouter(
        address tokenIn,
        uint256 tokenInAmount,
        address tokenOut
    ) private view returns (uint256) {
        if (tokenInAmount == 0) {
            return 0;
        }
        address[] memory path = new address[](2);
        path[0] = address(tokenIn);
        path[1] = address(tokenOut);
        uint256[] memory outputs = router.getAmountsOut(tokenInAmount, path);
        return outputs[1];
    }

    function getRequiredWBTCForUsd(uint256 usdAmount)
        private
        view
        returns (uint256)
    {
        return
            getRequiredAmountInFromRouter(
                address(wbtcToken),
                address(usdToken),
                usdAmount
            );
    }

    function getRequiredUsdForWBTC(uint256 wbtcAmount)
        private
        view
        returns (uint256)
    {
        return
            getRequiredAmountInFromRouter(
                address(usdToken),
                address(wbtcToken),
                wbtcAmount
            );
    }

    function getRequiredAmountInFromRouter(
        address tokenIn,
        address tokenOut,
        uint256 tokenOutAmount
    ) private view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(tokenIn);
        path[1] = address(tokenOut);
        uint256[] memory amountsIn = router.getAmountsIn(tokenOutAmount, path);
        return amountsIn[0];
    }

    function swapReserveTokenToCOP(
        IERC20 token,
        uint256 amountIn,
        uint256 minAmountOut
    ) private returns (uint256 amountOut) {
        uint256 totalUsd = amountIn;
        if (address(token) == address(wbtcToken)) {
            totalUsd = wBTCToUSD(amountIn);
        }
        amountOut = usdToCop(totalUsd);
        require(amountOut >= minAmountOut, "PegDex: INSUFFICIENT_OUTPUT");
        copToken.safeTransfer(msg.sender, amountOut);
    }

    function sendAmountOfUSDInReserveToken(
        uint256 amount,
        IERC20 token,
        uint256 minAmountOut
    ) private returns (uint256 amountOut) {
        if (address(token) == address(wbtcToken)) {
            amount = usdToWBTC(amount);
        }
        amountOut = obtainFinalReserveAmountToTransfer(token, amount);
        require(amountOut >= minAmountOut, "PegDex: INSUFFICIENT_OUTPUT");
        token.safeTransfer(msg.sender, amountOut);
    }

    function obtainFinalReserveAmountToTransfer(
        IERC20 token,
        uint256 desiredAmount
    ) private returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        if (desiredAmount > balance) {
            // Try to swap from the other reserve currency to complete the amount
            uint256 missingAmount = desiredAmount - balance;
            uint256 amountIn = address(token) == address(usdToken)
                ? getRequiredWBTCForUsd(missingAmount)
                : getRequiredUsdForWBTC(missingAmount);
            address(token) == address(usdToken)
                ? wbtcToken.safeIncreaseAllowance(address(router), amountIn)
                : usdToken.safeIncreaseAllowance(address(router), amountIn);
            address[] memory path = new address[](2);
            path[0] = address(token) == address(usdToken)
                ? address(wbtcToken)
                : address(usdToken);
            path[1] = address(token);
            uint256 amountOutMin = router.getAmountsOut(amountIn, path)[1];
            router.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                address(this),
                block.timestamp
            );
        }
        return desiredAmount;
    }

    function swapReserveToToken(
        IERC20 reserveToken,
        uint256 amountIn,
        IERC20 token,
        uint256 amountOut
    ) private returns (uint256) {
        reserveToken.safeIncreaseAllowance(address(router), amountIn);
        // Swap reserve token for token
        address[] memory path = new address[](2);
        path[0] = address(reserveToken);
        path[1] = address(token);

        if (address(token) == WETH) {
            return
                router.swapExactTokensForETH(
                    amountIn,
                    amountOut,
                    path,
                    msg.sender,
                    block.timestamp
                )[1];
        }

        return
            router.swapExactTokensForTokens(
                amountIn,
                amountOut,
                path,
                msg.sender,
                block.timestamp
            )[1];
    }

    function sendAmountOfUSDInNonReserveToken(
        uint256 amountInUsd,
        IERC20 token,
        uint256 minAmountOut
    ) private returns (uint256 amountOutNew) {
        uint256 amountOutWithUsd = calculateAmountOut(
            address(usdToken),
            amountInUsd,
            address(token)
        );
        // Check if wbtc output is better
        uint256 amountInWbtc = usdToWBTC(amountInUsd);
        uint256 amountOutWithWbtc = calculateAmountOut(
            address(wbtcToken),
            amountInWbtc,
            address(token)
        );

        if (
            amountOutWithUsd < amountOutWithWbtc ||
            usdToken.balanceOf(address(this)) < amountInUsd
        ) {
            require(
                amountOutWithWbtc >= minAmountOut,
                "PegDex: INSUFFICIENT_OUTPUT"
            );
            return
                swapReserveToToken(
                    wbtcToken,
                    amountInWbtc,
                    token,
                    amountOutWithWbtc
                );
        }
        require(
            amountOutWithUsd >= minAmountOut,
            "PegDex: INSUFFICIENT_OUTPUT"
        );
        return
            swapReserveToToken(usdToken, amountInUsd, token, amountOutWithUsd);
    }

    function calculateAmountWithFee(uint256 amount)
        private
        view
        returns (uint256)
    {
        return (amount * (1000 - fee)) / 1000;
    }

    function getAmountOutInUSD(uint256 copAmountIn)
        public
        view
        returns (uint256)
    {
        uint256 amountInMinFee = calculateAmountWithFee(copAmountIn);
        uint256 amountOutTRM = copToUsd(amountInMinFee);
        uint256 availableUSD = getAvailableUSD();
        if (availableUSD <= amountOutTRM) {
            return 0;
        }
        // Calculate the amount out with a higher penalty for taking out more liquidity
        return
            (amountInMinFee * (availableUSD - amountOutTRM)) /
            (usdToCop(availableUSD) + amountInMinFee);
    }

    function sendAmountInUSDOfToken(
        uint256 amountUSD,
        IERC20 token,
        uint256 minAmountOut
    ) private returns (uint256) {
        if (
            address(token) == address(usdToken) ||
            address(token) == address(wbtcToken)
        ) {
            return
                sendAmountOfUSDInReserveToken(amountUSD, token, minAmountOut);
        }

        return sendAmountOfUSDInNonReserveToken(amountUSD, token, minAmountOut);
    }

    function swapTokensForCOPPreview(IERC20 token, uint256 amountIn)
        public
        view
        returns (uint256 amountOut)
    {
        uint256 amounInWithFee = calculateAmountWithFee(amountIn);
        uint256 amountInReserve = amounInWithFee;
        if (
            address(token) != address(usdToken) &&
            address(token) != address(wbtcToken)
        ) {
            amountInReserve = calculateAmountOut(
                address(token),
                amounInWithFee,
                address(usdToken)
            );
            token = usdToken;
        }
        if (address(token) == address(usdToken)) {
            amountOut = usdToCop(amountInReserve);
        } else {
            amountOut = usdToCop(wBTCToUSD(amountInReserve));
        }
    }

    function swapTokensForCOP(
        IERC20 token,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 amountOut) {
        token.safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 amountInMinFee = calculateAmountWithFee(amountIn);
        uint256 amountInReserve = amountInMinFee;
        if (
            address(token) != address(usdToken) &&
            address(token) != address(wbtcToken)
        ) {
            amountInReserve = calculateAmountOut(
                address(token),
                amountInMinFee,
                address(usdToken)
            );

            address[] memory path = new address[](2);
            path[0] = address(token);
            path[1] = address(usdToken);
            token.safeIncreaseAllowance(address(router), amountInMinFee);
            router.swapExactTokensForTokens(
                amountInMinFee,
                amountInReserve,
                path,
                address(this),
                block.timestamp
            );
        }
        amountOut = swapReserveTokenToCOP(token, amountInReserve, minAmountOut);
        emit Swapped(
            msg.sender,
            address(token),
            amountIn,
            address(copToken),
            amountOut
        );
    }

    function swapCOPForTokensPreview(IERC20 token, uint256 amountIn)
        public
        view
        returns (uint256)
    {
        uint256 amountOutInUsd = getAmountOutInUSD(amountIn);
        if (address(token) == address(usdToken) || amountOutInUsd == 0) {
            return amountOutInUsd;
        }
        if (address(token) == address(wbtcToken)) {
            return usdToWBTC(amountOutInUsd);
        }
        uint256 amountInWbt = usdToWBTC(amountOutInUsd);
        uint256 totalOutWithUsd = calculateAmountOut(
            address(usdToken),
            amountOutInUsd,
            address(token)
        );
        uint256 totalOutWithWbtc = calculateAmountOut(
            address(wbtcToken),
            amountInWbt,
            address(token)
        );
        if (
            totalOutWithUsd < totalOutWithWbtc ||
            usdToken.balanceOf(address(this)) < amountOutInUsd
        ) {
            return totalOutWithWbtc;
        }
        return totalOutWithUsd;
    }

    function swapCOPForTokens(
        IERC20 token,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    )
        external
        nonReentrant
        ensure(deadline)
        onlyPeriodQuotaLeft(amountIn)
        returns (uint256 amountOut)
    {
        copToken.safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 amountOutInUSD = getAmountOutInUSD(amountIn);
        require(amountOutInUSD > 0, "PegDex: OUTPUT_TOO_LOW");
        amountOut = sendAmountInUSDOfToken(amountOutInUSD, token, minAmountOut);
        // Update liquidity slot if slotAmount is set
        if (slotAmount > 0) {
            slotAvailable = slotAvailable - amountOutInUSD <= slotMinimum
                ? getTotalLiquidityInUSD() > slotAmount
                    ? slotAmount
                    : getTotalLiquidityInUSD()
                : slotAvailable - amountOutInUSD;
        }

        emit Swapped(
            msg.sender,
            address(copToken),
            amountIn,
            address(token),
            amountOut
        );
    }
    

    function swapMaticForCOPPreview(uint256 amountIn)
        public
        view
        returns (uint256 amountOut)
    {
        amountOut = usdToCop(
            calculateAmountOut(
                WETH,
                calculateAmountWithFee(amountIn),
                address(usdToken)
            )
        );
    }

    function swapMaticForCOP(uint256 minAmountOut, uint256 deadline)
        external
        payable
        nonReentrant
        ensure(deadline)
        returns (uint256 amountOut)
    {
        uint256 amountUsdOut = calculateAmountOut(
            WETH,
            calculateAmountWithFee(msg.value),
            address(usdToken)
        );
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = address(usdToken);
        router.swapExactETHForTokens{value: msg.value}(
            amountUsdOut,
            path,
            address(this),
            block.timestamp
        );

        amountOut = usdToCop(amountUsdOut);
        require(amountOut >= minAmountOut, "PegDex: INSUFFICIENT_OUTPUT");
        copToken.safeTransfer(msg.sender, amountOut);

        emit Swapped(msg.sender, WETH, msg.value, address(copToken), amountOut);
    }

    function calculateAmountOut(
        address fromToken,
        uint256 fromTokenAmount,
        address toToken
    ) public view returns (uint256) {
        if (fromTokenAmount == 0) {
            return 0;
        }
        IUniswapV2Pair pair = IUniswapV2Pair(
            IUniswapV2Factory(router.factory()).getPair(fromToken, toToken)
        );
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        (uint256 fromTokenReserve, uint256 toTokenReserve) = pair.token0() ==
            fromToken
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        return
            router.getAmountOut(
                fromTokenAmount,
                fromTokenReserve,
                toTokenReserve
            );
    }

    /**
     * @notice called when the owner wants to unlock erc20 tokens owned by the contract
     * @param _tokenAddress the address of the tokens to unlock
     * @param _to the address to send the tokens to
     * @param _amount amount of tokens to unlock
     */
    function transferAnyERC20(
        address _tokenAddress,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        IERC20(_tokenAddress).safeTransfer(_to, _amount);
    }

    function setFee(uint16 _fee) external onlyOwner {
        fee = _fee;
    }

    function setArtificialPrice(int256 _artificialPrice) external onlyOwner {
        require(_artificialPrice >= 0, "PEGDEX: NEGATIVE_PRICE");
        artificialPrice = _artificialPrice;
    }

    function setLiquiditySlots(uint256 _amount, uint256 _minimum)
        external
        onlyOwner
    {
        require(_amount >= _minimum, "PEGDEX: MIN_TOO_HIGH");
        uint256 currentLiquidity = getTotalLiquidityInUSD();
        slotAmount = _amount;
        slotAvailable = currentLiquidity < _amount ? currentLiquidity : _amount;
        slotMinimum = _minimum;
    }

    function getCopPrice() public view returns (int256 price) {
        price = artificialPrice == 0 ? getLatestPrice() : artificialPrice;
    }

    function getTotalLiquidityInUSD() public view returns (uint256) {
        return
            usdToken.balanceOf(address(this)) +
            wBTCToUSD(wbtcToken.balanceOf(address(this)));
    }

    function getAvailableUSD() public view returns (uint256) {
        if (slotAmount > 0) {
            return slotAvailable;
        }

        return getTotalLiquidityInUSD();
    }

    /**
     * @notice called when owner wants to unlock Matic owned by the contract
     * @param _to the address to send the tokens to
     * @param _amount amount of tokens to unlock
     */
    function transferMatic(address _to, uint256 _amount) external onlyOwner {
        (bool sent, ) = _to.call{value: _amount}("");
        require(sent, "Failed to send Ether");
    }

    function copToUsd(uint256 copAmount) internal view returns (uint256) {
        uint256 usdPerCop = uint256(getCopPrice());
        uint256 expandedUsdAmount = copAmount * usdPerCop;
        return
            expandedUsdAmount /
            10 **
                (priceFeed.decimals() +
                    (copToken.decimals() - usdToken.decimals()));
    }

    function usdToCop(uint256 usdAmount) internal view returns (uint256) {
        uint256 copAmount = (usdAmount * (10**(priceFeed.decimals()))) /
            uint256(getCopPrice());
        return copAmount * (10**(copToken.decimals() - usdToken.decimals()));
    }
}
