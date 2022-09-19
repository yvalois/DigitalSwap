//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SellLimitter is Ownable {
    struct SoldInPeriod {
        uint256 amount;
        uint256 startOfPeriod;
    }

    uint256 public daysInSellPeriod;
    uint256 public periodSellLimit;
    mapping(address => SoldInPeriod) public salesInPeriod;

    modifier onlyPeriodQuotaLeft(uint256 sellAmount) {
        SoldInPeriod storage soldInPeriod = salesInPeriod[msg.sender];
        if (
            block.timestamp >=
            soldInPeriod.startOfPeriod + (daysInSellPeriod * 1 days)
        ) {
            soldInPeriod.amount = sellAmount;
            soldInPeriod.startOfPeriod = block.timestamp;
        } else {
            soldInPeriod.amount += sellAmount;
        }
        require(
            soldInPeriod.amount <= periodSellLimit,
            "PegDex: PERIOD_LIMIT_EXCEEDED"
        );
        _;
    }

    function setDaysInSellPeriod(uint256 _newDaysInSellPeriod)
        external
        onlyOwner
    {
        daysInSellPeriod = _newDaysInSellPeriod;
    }

    function setPeriodSellLimit(uint256 _newPeriodSellLimit)
        external
        onlyOwner
    {
        periodSellLimit = _newPeriodSellLimit;
    }
}
