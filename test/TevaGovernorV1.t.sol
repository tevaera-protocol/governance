// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
// import "forge-std/console.sol";
import "../contracts/TevaGovernorV1.sol";
import "../contracts/TeveTimelockControllerV1.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts/governance/IGovernor.sol";
import "../contracts/token/TevaTokenV1.sol"; // Import the mock contract

contract TevaGovernorV1Test is Test {
    TevaGovernorV1 governor;
    TeveTimelockControllerV1 timelock;
    TevaTokenV1 token;

    /*//////////////////////////////////////////////////////////////
                                ENUM AND STRUCT
    //////////////////////////////////////////////////////////////*/
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error GovernorRestrictedProposer(address proposer);
    error GovernorInsufficientProposerVotes(
        address proposer,
        uint256 votes,
        uint256 threshold
    );
    error GovernorInvalidProposalLength(
        uint256 targets,
        uint256 calldatas,
        uint256 values
    );
    error GovernorUnexpectedProposalState(
        uint256 proposalId,
        ProposalState current,
        bytes32 expectedStates
    );
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);

    /*//////////////////////////////////////////////////////////////
                        TEVA TIMELOCKCONTROLLER ROLES
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

    /*//////////////////////////////////////////////////////////////
                         TEVA TOKEN ROLES
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/
    // Admin Address
    address ADMIN = address(this);
    // Voters ALICE, BOD And CHARLE
    address constant ALICE =
        address(0x7ef27552FBf9f20Cb95b4722EFa9015F9fE9e7C5);
    address constant BOB = address(0x0000000000000000000000000000000000008001);
    address constant CHARLE =
        address(0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB);
    uint256 constant ALICE_TOKEN = 1000000000000000000000;
    uint256 constant BOB_TOKEN = 1000000000000000000000;
    uint256 constant CHARLE_TOKEN = 1000000000000000000000;
    uint256 constant THIS_ADDRESS_TOKEN = 1000000000000000000000;

    uint256 constant MIN_DELAY = 600; // 10 mins delay
    uint48 constant VOTING_DELAY = 10;
    uint32 constant VOTING_PERIOD = 1000;
    uint256 constant PROPOSAL_THRESHOLD = 1;
    uint256 constant QUORUM_PERCENTAGE = 4;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    /**
     * @dev Emitted when a proposal is created.
     */
    event ProposalCreated(
        uint256 proposalId,
        address proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 voteStart,
        uint256 voteEnd,
        string description
    );
    /**
     * @dev Emitted when a Vote is casted.
     */
    event VoteCast(
        address indexed voter,
        uint256 proposalId,
        uint8 support,
        uint256 weight,
        string reason
    );

    /*//////////////////////////////////////////////////////////////
                                SETUP
    //////////////////////////////////////////////////////////////*/
    function setUp() public {
        // Deploy the token using the mock
        token = new TevaTokenV1();
        token.initialize(); // Initialize the token

        // Grant Minter and Burner Role to admin
        token.grantRole(MINTER_ROLE, ADMIN);
        token.grantRole(BURNER_ROLE, ADMIN);

        // Mint Token Alice
        token.mint(ALICE, ALICE_TOKEN);
        token.mint(BOB, BOB_TOKEN);
        token.mint(CHARLE, CHARLE_TOKEN);
        token.mint(address(this), THIS_ADDRESS_TOKEN);
        vm.prank(ALICE);
        token.delegate(ALICE);
        vm.prank(BOB);
        token.delegate(BOB);
        vm.prank(CHARLE);
        token.delegate(CHARLE);
        token.delegate(address(this));

        // proposers executors
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = address(this);
        executors[0] = address(this);

        // Deploy the timelock contwarper
        timelock = new TeveTimelockControllerV1();
        timelock.initialize(MIN_DELAY, proposers, executors);

        // Deploy the governor
        governor = new TevaGovernorV1();
        governor.initialize(
            token,
            timelock,
            VOTING_DELAY,
            VOTING_PERIOD,
            PROPOSAL_THRESHOLD,
            QUORUM_PERCENTAGE
        );
        timelock.grantRole(EXECUTOR_ROLE, address(this));
    }
    /*//////////////////////////////////////////////////////////////
                                INITIALIZE TEST CASES
    //////////////////////////////////////////////////////////////*/
    function testInitialize() public view {
        assertEq(governor.name(), "TevaGovernor");
        assertEq(governor.votingDelay(), VOTING_DELAY);
        assertEq(governor.votingPeriod(), VOTING_PERIOD);
        assertEq(governor.proposalThreshold(), PROPOSAL_THRESHOLD);
    }

    /*//////////////////////////////////////////////////////////////
                                PROPOSE AND VOTE TEST CASES
    //////////////////////////////////////////////////////////////*/
    function testProposeAndVote() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        // Fast-forward to allow voting
        uint8 support = 1;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(ALICE);
        governor.castVote(proposalId, support);

        emit VoteCast(ALICE, proposalId, support, ALICE_TOKEN, "");
        // Assert vote counting
        // Vote by Alice
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = governor.proposalVotes(proposalId);

        assertEq(forVotes, ALICE_TOKEN);
        assertEq(againstVotes, 0);
        assertEq(abstainVotes, 0);
    }

    // Test case for GovernorInvalidProposalLength
    function testGovernorInvalidProposalLength() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](2);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Restricted Proposer";

        // Simulate a proposal by an unauthorized address (Bob) that should fail
        vm.prank(BOB);
        vm.warp(block.timestamp + 10);
        vm.expectRevert(
            abi.encodeWithSelector(
                GovernorInvalidProposalLength.selector,
                targets.length,
                calldatas.length,
                values.length
            )
        );
        governor.propose(targets, values, calldatas, description);
    }

    // Test case for GovernorRestrictedProposer
    function testGovernorInsufficientProposerVotes() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Restricted Proposer";

        // Simulate a proposal by an unauthorized address (Bob) that should fail
        vm.prank(BOB);
        vm.expectRevert(
            abi.encodeWithSelector(
                GovernorInsufficientProposerVotes.selector,
                BOB,
                0,
                PROPOSAL_THRESHOLD
            )
        );
        governor.propose(targets, values, calldatas, description);
    }

    // Test case for GovernorUnexpectedProposalState
    function testGovernorUnexpectedProposalState() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Restricted Proposer";

        vm.prank(BOB);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );

        vm.prank(BOB);
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.expectRevert(
            abi.encodeWithSelector(
                GovernorUnexpectedProposalState.selector,
                proposalId,
                ProposalState.Active,
                0x0000000000000000000000000000000000000000000000000000000000000000
            )
        );
        governor.propose(targets, values, calldatas, description);
    }

    // Test Case to check revert when voting not started
    function testVotingNotStarted() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        uint8 support = 1;
        // Fast-forward to allow voting
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(
                GovernorUnexpectedProposalState.selector,
                proposalId,
                0,
                0x0000000000000000000000000000000000000000000000000000000000000002
            )
        );
        governor.castVote(proposalId, support);

        // Assert vote counting
        // Vote by Alice
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = governor.proposalVotes(proposalId);

        assertEq(forVotes, 0);
        assertEq(againstVotes, 0);
        assertEq(abstainVotes, 0);
    }

    // test case to have voting on multiple users
    function testVoteByAliceAndBobPlusCharle() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        // Fast-forward to allow voting
        // Vote by Alice
        uint8 support = 1;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(ALICE);
        governor.castVote(proposalId, support);
        emit VoteCast(ALICE, proposalId, support, ALICE_TOKEN, "");

        // Vote by Bob
        uint8 against = 0;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(BOB);
        governor.castVote(proposalId, against);
        emit VoteCast(BOB, proposalId, against, BOB_TOKEN, "");

        // Vote by Charle
        uint8 abstain = 2;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(CHARLE);
        governor.castVote(proposalId, abstain);
        emit VoteCast(CHARLE, proposalId, abstain, CHARLE_TOKEN, "");

        // Assert vote counting
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = governor.proposalVotes(proposalId);

        assertEq(forVotes, ALICE_TOKEN);
        assertEq(againstVotes, BOB_TOKEN);
        assertEq(abstainVotes, CHARLE_TOKEN);
    }

    // test case for testing vote for support side status check
    function testForVote() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        // Fast-forward to allow voting
        uint8 support = 1;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(ALICE);
        governor.castVote(proposalId, support);
        emit VoteCast(ALICE, proposalId, support, ALICE_TOKEN, "");
        // Assert vote counting
        // Vote by Alice
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = governor.proposalVotes(proposalId);

        assertEq(forVotes, ALICE_TOKEN);
        assertEq(againstVotes, 0);
        assertEq(abstainVotes, 0);
    }

    // test case for check on against vote status check
    function testAgainstVote() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        // Fast-forward to allow voting
        // alice for the vote proposal
        uint8 against = 0;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(ALICE);
        governor.castVote(proposalId, against);

        emit VoteCast(ALICE, proposalId, against, ALICE_TOKEN, "");
        // Assert vote counting
        // Vote by Alice
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = governor.proposalVotes(proposalId);

        assertEq(forVotes, 0);
        assertEq(againstVotes, ALICE_TOKEN);
        assertEq(abstainVotes, 0);
    }

    // test case for check on abstain vote status check
    function testAbstainVote() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        // Create and propose
        targets[0] = address(this);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        // Fast-forward to allow voting
        uint8 abstain = 2;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(ALICE);
        governor.castVote(proposalId, abstain);

        emit VoteCast(ALICE, proposalId, abstain, ALICE_TOKEN, "");
        // Assert vote counting
        // Vote by Alice
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = governor.proposalVotes(proposalId);

        assertEq(forVotes, 0);
        assertEq(againstVotes, 0);
        assertEq(abstainVotes, ALICE_TOKEN);
    }

    // test case on execution side
    function testExecution() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        // Create and propose
        targets[0] = address(this);

        values[0] = 0;

        calldatas[0] = abi.encodeWithSignature("votingPeriod()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        // Fast-forward to allow voting
        // Vote By Alice
        uint8 support = 1;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(ALICE);
        governor.castVote(proposalId, support);
        emit VoteCast(ALICE, proposalId, support, ALICE_TOKEN, "");

        // Vote By Bob
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(BOB);
        governor.castVote(proposalId, support);
        emit VoteCast(BOB, proposalId, support, BOB_TOKEN, "");

        // Grant roles to timelock contract for governor
        timelock.grantRole(EXECUTOR_ROLE, address(governor));
        timelock.grantRole(PROPOSER_ROLE, address(governor));
        timelock.grantRole(CANCELLER_ROLE, address(governor));

        bytes32 descriptionHash = keccak256(bytes(description));
        // Move past voting period
        // Queue and execute the proposal
        vm.warp(block.timestamp + governor.votingPeriod() + 10);
        governor.queue(targets, values, calldatas, descriptionHash);
        vm.warp(block.timestamp + MIN_DELAY + 10);
        // governor.execute{value: 0}(targets, values, calldatas, descriptionHash);

        // uint8 proposalState = uint8(governor.state(proposalId));
        // // Assert that the proposal was executed
        // assertEq(proposalState, uint8(IGovernor.ProposalState.Executed));
    }

    // test case on execution when caller is not authorised
    function testExecutionNotAuthorised() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        // Create and propose
        targets[0] = address(this);

        values[0] = 0;

        calldatas[0] = abi.encodeWithSignature("doSomething()");

        string memory description = "Proposal to do something";
        vm.prank(ALICE);
        vm.warp(block.timestamp + 10);
        uint256 proposalId = governor.propose(
            targets,
            values,
            calldatas,
            description
        );
        emit ProposalCreated(
            proposalId,
            ALICE,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            governor.clock() + governor.votingDelay() - 1,
            governor.clock() +
                governor.votingDelay() +
                governor.votingPeriod() -
                1,
            description
        );

        // Fast-forward to allow voting
        // Vote By Alice
        uint8 support = 1;
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(ALICE);
        governor.castVote(proposalId, support);
        emit VoteCast(ALICE, proposalId, support, ALICE_TOKEN, "");

        // Vote By Bob
        vm.warp(governor.clock() + governor.votingDelay() + 10);
        vm.prank(BOB);
        governor.castVote(proposalId, support);
        emit VoteCast(BOB, proposalId, support, BOB_TOKEN, "");

        bytes32 descriptionHash = keccak256(bytes(description));
        // Move past voting period
        // Queue and execute the proposal
        vm.warp(block.timestamp + governor.votingPeriod() + 10);
        vm.expectRevert();
        governor.queue(targets, values, calldatas, descriptionHash);

        vm.warp(block.timestamp + MIN_DELAY + 10);
        vm.expectRevert();
        governor.execute{value: 0}(targets, values, calldatas, descriptionHash);
    }

    // test case to timelock control minDelay
    function testTimelockControl() public view {
        assertEq(timelock.getMinDelay(), MIN_DELAY);
    }
}
