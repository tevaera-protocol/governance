// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./VestingWalletCliffUpgradeable.sol";
import "./token/TevaTokenV1.sol";

contract MultiVestingWalletCliffV1 is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    TevaTokenV1 public tevaToken;

    /// @dev Mapping to track vesting wallets for each beneficiary.
    /// Each beneficiary address maps to their respective `VestingWalletCliffUpgradeable` contract.
    mapping(address => VestingWalletCliffUpgradeable) public vestingWallets;

    /// @dev Event emitted when a new vesting wallet is created for a beneficiary.
    /// @param beneficiary The address of the beneficiary for whom the vesting wallet is created.
    /// @param vestingWalletcliff The address of the newly created vesting wallet.
    /// @param start The start time of the vesting schedule (in UNIX timestamp).
    /// @param duration The total duration of the vesting period.
    /// @param cliff The duration before the first release (cliff period).
    event VestingWalletCreated(
        address indexed beneficiary,
        address indexed vestingWalletcliff,
        uint64 start,
        uint64 duration,
        uint64 cliff
    );

    /// @dev Event emitted when tokens are released from a vesting wallet.
    /// @param beneficiary The address of the beneficiary whose tokens were released.
    /// @param vestingWalletcliff The address of the vesting wallet from which tokens were released.
    /// @param amount The amount of tokens that were released.
    event ReleasedVestedTokens(
        address indexed beneficiary,
        address indexed vestingWalletcliff,
        uint256 amount
    );

    /// @dev Zero Address
    error ZeroAddress();

    function initialize(address _tevaToken) external initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        tevaToken = TevaTokenV1(_tevaToken);
    }

    /// @dev Creates a new vesting wallet for a specified beneficiary.
    /// Can only be called by the contract owner. The vesting schedule is defined by the start time,
    /// duration, cliff period, and the number of tokens to be vested.
    /// @param beneficiary The address of the beneficiary who will receive the vested tokens.
    /// @param start The start time of the vesting schedule (in UNIX timestamp).
    /// @param duration The total duration of the vesting period.
    /// @param cliff The duration before the first release of tokens (cliff period).
    /// @param amount The amount of tokens to be vested for the beneficiary.
    function createVestingWallet(
        address beneficiary,
        uint64 start,
        uint64 duration,
        uint64 cliff,
        uint256 amount
    ) external onlyOwner nonReentrant {
        // Revert for Zero Address
        if (beneficiary == address(0)) revert ZeroAddress();

        // Ensure vesting wallet doesn't exist for the beneficiary
        require(
            address(vestingWallets[beneficiary]) == address(0),
            "Vesting wallet already exists"
        );

        // schdule validation and cliff after start and before end
        require(cliff >= start, "cliff>=start");

        require(
            cliff <= start + duration,
            "cliff must not exceed vesting end time"
        );

        // Create a new vesting wallet for the beneficiary
        VestingWalletCliffUpgradeable vestingWallet = new VestingWalletCliffUpgradeable();
        vestingWallet.initialize(beneficiary, start, duration, cliff);
        vestingWallets[beneficiary] = vestingWallet;

        // Mint tokens to the vesting wallet, locking them for the vesting schedule.
        tevaToken.mint(address(vestingWallet), amount);

        // Emit an event signaling the creation of the new vesting wallet.
        emit VestingWalletCreated(
            beneficiary,
            address(vestingWallet),
            start,
            duration,
            cliff
        );
    }

    function releaseVestedTokens() external nonReentrant {
        VestingWalletCliffUpgradeable vestingWallet = vestingWallets[
            msg.sender
        ];

        //Ensure that the beneficiary has an associated vesting wallet.
        require(
            address(vestingWallet) != address(0),
            "No vesting wallet found"
        );

        //Calculate the amount of vested tokens that can be released and release them.
        uint256 amount = vestingWallet.releasable(address(tevaToken));
        vestingWallet.release(address(tevaToken));

        emit ReleasedVestedTokens(msg.sender, address(vestingWallet), amount);
    }

    /// @dev Retrieves the total amount of tokens that have vested up to a given timestamp
    /// for a specific beneficiary.
    /// @param beneficiary The address of the beneficiary whose vested amount is being queried.
    /// @param _timestamp The UNIX timestamp up to which the vested amount is calculated.
    /// @return The total amount of vested tokens for the beneficiary as of the provided timestamp.
    function vestedAmount(
        address beneficiary,
        uint64 _timestamp
    ) public view virtual returns (uint256) {
        VestingWalletCliffUpgradeable vestingWallet = vestingWallets[
            beneficiary
        ];

        //Ensure that the beneficiary has an associated vesting wallet.
        require(
            address(vestingWallet) != address(0),
            "No vesting wallet found for this beneficiary"
        );

        // Return the amount of tokens vested for the beneficiary as of the given timestamp.
        return vestingWallet.vestedAmount(address(tevaToken), _timestamp);
    }

    // Reserve storage space for future upgrades
    uint256[50] private __gap;
}
