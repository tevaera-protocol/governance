// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/finance/VestingWalletUpgradeable.sol";

/**
 * @dev Custom VestingWallet with a cliff period added.
 * This contract extends OpenZeppelin's VestingWalletUpgradeable, adding a cliff period feature
 * where no tokens are vested until the cliff period has passed.
 */
contract VestingWalletCliffUpgradeable is VestingWalletUpgradeable {
    address private multiVestingWalletAddress;
    uint256 private amount;

    /// @custom:storage-location erc7201:openzeppelin.storage.VestingWalletCliff
    /// @dev This structure stores the cliff timestamp in a custom storage location to extend the base storage of VestingWalletUpgradeable.
    struct VestingWalletCliffStorage {
        uint64 _cliff; // The timestamp marking the end of the cliff period.
    }

    // @dev Constant for identifying the storage slot where the cliff information is stored.
    // The slot is calculated to avoid storage collisions with other contracts.
    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.VestingWalletCliff")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant VestingWalletCliffStorageLocation =
        0x0a0ceb66c7c9aef32c0bfc43d3108868a39e95e96162520745e462557492f100;

    /**
     * @dev Internal function to access the storage location for the cliff.
     * Uses assembly to load the storage slot to maintain upgradeable storage compatibility.
     * @return $ Reference to the storage slot for the cliff.
     */
    function _getVestingWalletCliffStorage()
        private
        pure
        returns (VestingWalletCliffStorage storage $)
    {
        assembly {
            $.slot := VestingWalletCliffStorageLocation
        }
    }

    /**
     * @dev Initializes the vesting wallet with cliff functionality.
     * Calls the base `__VestingWallet_init` function to set the beneficiary, vesting start,
     * and linear vesting duration, and sets the cliff period's end time.
     * @param _beneficiaryAddress The address of the wallet that will receive the vested tokens.
     * @param _amount The total amount to be vested.
     * @param _vestingStartTime The start time of the vesting schedule (in UNIX timestamp).
     * @param _linearVestingDurationSeconds The total duration for the vesting to complete.
     * @param _cliffEndTime The UNIX timestamp marking the end of the cliff period.
     */
    function initialize(
        address _beneficiaryAddress,
        address _multiVestingWalletAddress,
        uint256 _amount,
        uint64 _vestingStartTime,
        uint64 _linearVestingDurationSeconds,
        uint64 _cliffEndTime
    ) external initializer {
        //Access the storage for cliff timestamp and initialize the vesting wallet.
        VestingWalletCliffStorage storage $ = _getVestingWalletCliffStorage();
        __VestingWallet_init(
            _beneficiaryAddress,
            _vestingStartTime,
            _linearVestingDurationSeconds
        );
        $._cliff = _cliffEndTime;
        multiVestingWalletAddress = _multiVestingWalletAddress;
        amount = _amount;
    }

    function changeOwner(address _newOwner) external {
        require(
            msg.sender == multiVestingWalletAddress,
            "caller must be multiVestingWallet"
        );
        if (_newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(_newOwner);
    }

    /**
     * @dev Getter function for retrieving the cliff end timestamp.
     * This allows other contracts or external users to query when the cliff period ends.
     * @return The UNIX timestamp when the cliff period ends.
     */
    function cliff() public view virtual returns (uint256) {
        VestingWalletCliffStorage storage $ = _getVestingWalletCliffStorage();
        return $._cliff;
    }

    /**
     * @dev Overrides the base vesting schedule to implement cliff logic.
     * If the cliff period has not passed, the function returns 0 (no tokens vested).
     * Otherwise, it calls the parent contract's `_vestingSchedule` to calculate the vesting based on the time.
     * @param totalAllocation The total number of tokens to be vested over the duration.
     * @param timestamp The current timestamp for which the vested amount is being queried.
     * @return The number of tokens vested at the provided timestamp, or 0 if the cliff period is not yet reached.
     */
    function _vestingSchedule(
        uint256 totalAllocation,
        uint64 timestamp
    ) internal view virtual override returns (uint256) {
        return
            timestamp < cliff()
                ? 0
                : super._vestingSchedule(totalAllocation, timestamp);
    }

    /**
     * @dev Overriden getter for the amount of releasable eth.
     */
    function releasable() public view virtual override returns (uint256) {
        return this.vestedAmount(uint64(block.timestamp)) - released();
    }

    /**
     * @dev Overriden getter for the amount of releasable `token` tokens. `token` should be the address of an
     * {IERC20} contract.
     */
    function releasable(
        address token
    ) public view virtual override returns (uint256) {
        return vestedAmount(token, uint64(block.timestamp)) - released(token);
    }

    /**
     * @dev Overriden method which calculates the amount of tokens that has already vested. Default implementation is a linear vesting curve.
     */
    function vestedAmount(
        uint64 timestamp
    ) public view virtual override returns (uint256) {
        return _vestingSchedule(amount, timestamp);
    }

    /**
     * @dev Overriden method which calculates the amount of tokens that has already vested. Default implementation is a linear vesting curve.
     */
    function vestedAmount(
        address token,
        uint64 timestamp
    ) public view virtual override returns (uint256) {
        return
            _vestingSchedule(
                IERC20(token).balanceOf(address(this)) + released(token),
                timestamp
            );
    }
}
