// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
// import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../contracts/token/TevaTokenV1.sol"; // Import the mock Teva Token contract
import "../contracts/MultiVestingWalletCliffV1.sol";
import "../contracts/VestingWalletCliffUpgradeable.sol";

contract MultiVestingWalletCliffV1Test is Test {
    MultiVestingWalletCliffV1 multiVestingWallet;
    TevaTokenV1 token;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error ERC20InsufficientBalance(
        address sender,
        uint256 balance,
        uint256 needed
    );
    error OwnableUnauthorizedAccount(address owner);

    /*//////////////////////////////////////////////////////////////
                        TEVA TOKEN ROLES
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/
    // Voters ALICE, BOD And CHARLE
    address OWNER = address(this);
    address constant BENEFICIARY_1 =
        address(0x0000000000000000000000000000000000008001);
    address constant BENEFICIARY_2 =
        address(0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB);
    address constant BENEFICIARY_3 =
        address(0x617F2E2fD72FD9D5503197092aC168c91465E7f2);
    uint256 constant OWNER_TOKEN = 1000000000000000000000;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    // Event for vesting schedule creation
    event VestingWalletCreated(
        address indexed beneficiary,
        address indexed vestingWalletcliff,
        uint64 start,
        uint64 duration,
        uint64 cliff
    );

    // Event for vesting schedule creation
    event ReleasedVestedTokens(
        address indexed beneficiary,
        address indexed vestingWalletcliff,
        uint256 amount
    );

    /*//////////////////////////////////////////////////////////////
                                SETUP
    //////////////////////////////////////////////////////////////*/
    function setUp() public {
        // Deploy ERC20 mock token (Mock Test Token)
        // Deploy the token using the mock
        token = new TevaTokenV1();
        token.initialize(); // Initialize the token

        // Grant Minter and Burner Role to admin
        vm.prank(OWNER);
        token.grantRole(MINTER_ROLE, OWNER);
        vm.prank(address(this));
        token.grantRole(BURNER_ROLE, OWNER);

        // Mint tokens to the owner
        vm.prank(OWNER);
        token.mint(OWNER, 1_000_000_000 ether);

        // Deploy the MultiVestingWalletCliffV1 contract
        multiVestingWallet = new MultiVestingWalletCliffV1();
        multiVestingWallet.initialize(address(token));

        // Grant Minter and Burner Role to admin
        vm.prank(OWNER);
        token.grantRole(MINTER_ROLE, address(multiVestingWallet));
    }

    /*//////////////////////////////////////////////////////////////
                                INITIALIZE TEST CASES
    //////////////////////////////////////////////////////////////*/
    function testInitialize() public view {
        assertEq(multiVestingWallet.owner(), OWNER);
    }

    /*//////////////////////////////////////////////////////////////
                CREATE WALLET AND VESTING SCHDULES TEST CASES
    //////////////////////////////////////////////////////////////*/
    function testCreateVestingWallet() public {
        // Set token transfer amount
        uint256 vestingAmount = 10 ether;

        // time-based vesting schdule
        uint64 cliff = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );
        emit VestingWalletCreated(
            BENEFICIARY_1,
            address(multiVestingWallet.vestingWallets(BENEFICIARY_1)),
            startTime,
            duration,
            cliff
        );

        // Check the vesting wallet has been created for beneficiary1
        address vestingWalletAddr = address(
            multiVestingWallet.vestingWallets(BENEFICIARY_1)
        );

        assertTrue(
            vestingWalletAddr != address(0),
            "Vesting wallet should be created"
        );

        // Check the token balance in the vesting wallet
        assertEq(
            token.balanceOf(vestingWalletAddr),
            vestingAmount,
            "Incorrect token balance in vesting wallet"
        );
    }

    function testAbleToCreateWalletWithoutBalanceOnMultiVestingCliffContract()
        public
    {
        // Set token transfer amount
        uint256 vestingAmount = 100000000000000000;

        // time-based vesting schdule
        uint64 cliff = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        assertEq(
            token.balanceOf(address(multiVestingWallet)),
            0,
            "Zero Balance"
        );
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );
    }

    function testNotOwnerUnableToCreateWallet(address notOwner) public {
        require(notOwner != address(0) && notOwner != OWNER);
        // Set token transfer amount
        uint256 vestingAmount = 100000000000000000;

        // time-based vesting schdule
        uint64 cliff = 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + cliff; // Current timestamp + cliff from where linear vesting start
        uint64 duration = 365 days; // 1 year vesting period

        vm.prank(notOwner);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUnauthorizedAccount.selector,
                notOwner
            )
        );
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );
    }

    function testOwnerOfCreatedVestingWallet() public {
        // Set token transfer amount
        uint256 vestingAmount = 10 ether;

        // time-based vesting schdule
        uint64 cliff = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );
        emit VestingWalletCreated(
            BENEFICIARY_1,
            address(multiVestingWallet.vestingWallets(BENEFICIARY_1)),
            startTime,
            duration,
            cliff
        );

        // Check the vesting wallet has been created for beneficiary1
        address vestingWalletAddr = address(
            multiVestingWallet.vestingWallets(BENEFICIARY_1)
        );

        assertTrue(
            vestingWalletAddr != address(0),
            "Vesting wallet should be created"
        );

        // Check the token balance in the vesting wallet
        assertEq(
            token.balanceOf(vestingWalletAddr),
            vestingAmount,
            "Incorrect token balance in vesting wallet"
        );

        assertEq(
            address(
                VestingWalletCliffUpgradeable(
                    multiVestingWallet.vestingWallets(BENEFICIARY_1)
                ).owner()
            ),
            BENEFICIARY_1,
            "Incorrect token balance in vesting wallet"
        );
    }

    function testVestingSchduleForCreatedVestingWallet() public {
        // Set token transfer amount
        uint256 vestingAmount = 100_000 ether;

        // time-based vesting schdule
        uint64 cliff = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );
        emit VestingWalletCreated(
            BENEFICIARY_1,
            address(multiVestingWallet.vestingWallets(BENEFICIARY_1)),
            startTime,
            duration,
            cliff
        );

        // Check the vesting wallet has been created for beneficiary1
        address vestingWalletAddr = address(
            multiVestingWallet.vestingWallets(BENEFICIARY_1)
        );

        assertTrue(
            vestingWalletAddr != address(0),
            "Vesting wallet should be created"
        );

        // Check the token balance in the vesting wallet
        assertEq(
            token.balanceOf(vestingWalletAddr),
            vestingAmount,
            "Incorrect token balance in vesting wallet"
        );

        assertEq(
            uint64(
                VestingWalletCliffUpgradeable(
                    multiVestingWallet.vestingWallets(BENEFICIARY_1)
                ).start()
            ),
            startTime,
            "Incorrect token balance in vesting wallet"
        );

        assertEq(
            uint64(
                VestingWalletCliffUpgradeable(
                    multiVestingWallet.vestingWallets(BENEFICIARY_1)
                ).end()
            ),
            startTime + duration,
            "Incorrect token balance in vesting wallet"
        );

        assertEq(
            uint64(
                VestingWalletCliffUpgradeable(
                    multiVestingWallet.vestingWallets(BENEFICIARY_1)
                ).cliff()
            ),
            cliff,
            "Incorrect token balance in vesting wallet"
        );

        assertEq(
            uint64(
                VestingWalletCliffUpgradeable(
                    multiVestingWallet.vestingWallets(BENEFICIARY_1)
                ).duration()
            ),
            duration,
            "Incorrect token balance in vesting wallet"
        );
    }

    function testOwnerOfCreateVestingWallet() public {
        // Set token transfer amount
        uint256 vestingAmount = 100_000 ether;

        // time-based vesting schdule
        uint64 cliff = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );

        emit VestingWalletCreated(
            BENEFICIARY_1,
            address(multiVestingWallet.vestingWallets(BENEFICIARY_1)),
            startTime,
            duration,
            cliff
        );

        // Check the vesting wallet has been created for beneficiary1
        address vestingWalletAddr = address(
            multiVestingWallet.vestingWallets(BENEFICIARY_1)
        );

        assertTrue(
            vestingWalletAddr != address(0),
            "Vesting wallet should be created"
        );

        // Check the token balance in the vesting wallet
        assertEq(
            token.balanceOf(vestingWalletAddr),
            vestingAmount,
            "Incorrect token balance in vesting wallet"
        );
    }

    function testCreateVestingWalletForThreeBeneficiary() public {
        // time-based vesting schdule : Same Vesting Amount for all three
        uint64 cliff_1 = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime_1 = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration_1 = 365 days; // 1 year vesting period
        uint256 vestingAmount = 100000000000000000000; // 100 ether

        _createWallet(
            BENEFICIARY_1,
            vestingAmount,
            startTime_1,
            duration_1,
            cliff_1
        );
        // Check the vesting wallet has been created for beneficiary1
        address vestingWalletAddr_1 = address(
            multiVestingWallet.vestingWallets(BENEFICIARY_1)
        );
        assertTrue(
            vestingWalletAddr_1 != address(0),
            "Vesting wallet should be created"
        );

        // Check the token balance in the vesting wallet
        assertEq(
            token.balanceOf(vestingWalletAddr_1),
            vestingAmount,
            "Incorrect token balance in vesting wallet"
        );

        // Beneficiary 2
        // time-based vesting schdule
        uint64 cliff_2 = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime_2 = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration_2 = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        _createWallet(
            BENEFICIARY_2,
            vestingAmount,
            startTime_2,
            duration_2,
            cliff_2
        );
        // Check the vesting wallet has been created for beneficiary1
        address vestingWalletAddr_2 = address(
            multiVestingWallet.vestingWallets(BENEFICIARY_1)
        );
        assertTrue(
            vestingWalletAddr_2 != address(0),
            "Vesting wallet should be created"
        );

        // Check the token balance in the vesting wallet
        assertEq(
            token.balanceOf(vestingWalletAddr_2),
            vestingAmount,
            "Incorrect token balance in vesting wallet"
        );

        // Beneficiary 3
        // time-based vesting schdule
        uint64 cliff_3 = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime_3 = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration_3 = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        _createWallet(
            BENEFICIARY_3,
            vestingAmount,
            startTime_3,
            duration_3,
            cliff_3
        );
        // Check the vesting wallet has been created for beneficiary1
        address vestingWalletAddr_3 = address(
            multiVestingWallet.vestingWallets(BENEFICIARY_1)
        );
        assertTrue(
            vestingWalletAddr_3 != address(0),
            "Vesting wallet should be created"
        );

        // Check the token balance in the vesting wallet
        assertEq(
            token.balanceOf(vestingWalletAddr_3),
            vestingAmount,
            "Incorrect token balance in vesting wallet"
        );
    }

    /*/////////////////////////////////////////////////////////////////////////
       TEST CASE ON RELEASE TOKEN TO OWNER OF VESTED WALLET AND VESTED AMOUNT
    /////////////////////////////////////////////////////////////////////////*/
    function testReleaseVestedTokens() public {
        uint256 vestingAmount = 100 ether;

        /// time-based vesting schdule
        uint64 cliff = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration = 365 days; // 1 year vesting period

        // Create vesting wallet and assign tokens
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );

        // Fast-forward time to after the cliff
        // Release vested tokens for beneficiary1
        vm.prank(BENEFICIARY_1);
        vm.warp(startTime + 91 days);  // cliff for 90 days
        multiVestingWallet.releaseVestedTokens();
        // Check the beneficiary's balance for released tokens
        uint256 beneficiaryBalance = token.balanceOf(BENEFICIARY_1);
        assertGt(beneficiaryBalance, 0, "Vested tokens should be released");
    }

    function testErrorForNotCreatedWalletOnReleaseVestedTokensCall() public {
        // Release vested tokens for beneficiary1
        vm.expectRevert();
        multiVestingWallet.releaseVestedTokens();
    }

    function testVestedAmount() public {
        // Set token transfer amount
        uint256 vestingAmount = 1000000000000000000000; // 1000 ether

        // time-based vesting schdule
        uint64 cliff = uint64(block.timestamp) + 90 days; // 3 months cliff period
        uint64 startTime = uint64(block.timestamp) + 60 days; // Current timestamp + 2 months
        uint64 duration = 365 days; // 1 year vesting period

        // Start creating the vesting wallet
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            BENEFICIARY_1,
            startTime,
            duration,
            cliff,
            vestingAmount
        );

        // Warp time to halfway through the vesting period
        vm.warp(startTime + (duration / 2));
        // Check the vested amount for beneficiary1
        uint256 vestedAmount = multiVestingWallet.vestedAmount(
            BENEFICIARY_1,
            uint64(block.timestamp)
        );

        assertGt(
            vestedAmount,
            0,
            "Vested amount should be greater than 0 after cliff period"
        );
        uint256 expectedVestedAmount = (vestingAmount *
            (block.timestamp - startTime)) / duration;
        assertEq(
            vestedAmount,
            expectedVestedAmount,
            "Expected Vested Amount Should be Equal to Vested Amount"
        );
    }

    function _createWallet(
        address beneficiary,
        uint256 vestingAmount,
        uint64 startTime,
        uint64 duration,
        uint64 cliff
    ) internal {
        // Start creating the vesting wallet
        vm.prank(OWNER);
        multiVestingWallet.createVestingWallet(
            beneficiary,
            startTime,
            duration,
            cliff,
            vestingAmount
        );
    }
}
