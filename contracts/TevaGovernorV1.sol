// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @dev A custom governance contract using OpenZeppelin's GovernorUpgradeable and extensions.
 * This contract allows voting, quorum management, and timelock-based execution of proposals.
 */
contract TevaGovernorV1 is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorTimelockControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    /**
     * @dev Initializes the Governor contract with settings for voting, quorum, and timelock control.
     * @param _token The ERC20Votes token that is used for governance voting.
     * @param _timelock The timelock controller that manages the execution delay of proposals.
     * @param _votingDelay The delay before voting on a proposal starts.
     * @param _votingPeriod The period during which votes can be cast on a proposal.
     * @param _proposalThreshold The minimum token holdings required to propose a governance action.
     * @param _quorumPercentage The percentage of total votes required for a proposal to reach quorum.
     */
    function initialize(
        ERC20VotesUpgradeable _token,
        TimelockControllerUpgradeable _timelock,
        uint48 _votingDelay,
        uint32 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumPercentage
    ) public initializer {
        __Governor_init("TevaGovernor");
        __GovernorSettings_init(
            _votingDelay,
            _votingPeriod,
            _proposalThreshold
        );
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(_quorumPercentage);
        __GovernorTimelockControl_init(_timelock);
        __GovernorCountingSimple_init();
        __ReentrancyGuard_init();
    }

    /**
     * @dev Returns the delay before voting on a proposal starts.
     * Combines the base and settings override implementations.
     */
    function votingDelay()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    /**
     * @dev Returns the duration of the voting period for proposals.
     * Combines the base and settings override implementations.
     */
    function votingPeriod()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    /**
     * @dev Returns the quorum number based on the total supply of the token.
     * @param blockNumber The block number at which the quorum is being calculated.
     * Combines the base and quorum fraction override implementations.
     */
    function quorum(
        uint256 blockNumber
    )
        public
        view
        override(GovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    /**
     * @dev Retrieves the votes of a specific account for governance.
     * @param account The address of the account whose votes are being queried.
     * @param blockNumber The block number at which the votes are counted.
     * @param params Additional parameters for the voting calculation.
     * Combines the base and votes override implementations.
     */
    function _getVotes(
        address account,
        uint256 blockNumber,
        bytes memory params
    )
        internal
        view
        override(GovernorUpgradeable, GovernorVotesUpgradeable)
        returns (uint256)
    {
        return super._getVotes(account, blockNumber, params);
    }

    /**
     * @dev Creates a new governance proposal.
     * @param targets The addresses of the contracts to be called by the proposal.
     * @param values The values (in Wei) sent along with the calls.
     * @param calldatas The calldata for each contract call in the proposal.
     * @param description A description of the proposal.
     * @return The ID of the created proposal.
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    /**
     * @dev Executes an approved governance proposal.
     * @param targets The addresses of the contracts to be called by the proposal.
     * @param values The values (in Wei) sent along with the calls.
     * @param calldatas The calldata for each contract call in the proposal.
     * @param descriptionHash The hashed description of the proposal.
     * @return The ID of the executed proposal.
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override nonReentrant returns (uint256) {
        return super.execute(targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev Counts votes for a specific proposal and records the support level.
     * @param proposalId The ID of the proposal being voted on.
     * @param account The address of the voter.
     * @param support The support level (0 = against, 1 = for, 2 = abstain).
     * @param weight The weight of the voter's tokens.
     * @param params Additional voting parameters.
     */
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory params
    )
        internal
        override(GovernorUpgradeable, GovernorCountingSimpleUpgradeable)
    {
        super._countVote(proposalId, account, support, weight, params);
    }

    /**
     * @dev Checks if the quorum for a proposal has been reached.
     * @param proposalId The ID of the proposal being checked.
     * @return True if the quorum has been reached, false otherwise.
     */
    function _quorumReached(
        uint256 proposalId
    )
        internal
        view
        override(GovernorUpgradeable, GovernorCountingSimpleUpgradeable)
        returns (bool)
    {
        return super._quorumReached(proposalId);
    }

    /**
     * @dev Returns the threshold of votes required to submit a proposal.
     */
    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    /**
     * @dev Returns the current state of a proposal.
     * @param proposalId The ID of the proposal being queried.
     * @return The state of the proposal (Pending, Active, Canceled, etc.).
     */
    function state(
        uint256 proposalId
    )
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (ProposalState)
    {
        return GovernorTimelockControlUpgradeable.state(proposalId);
    }

    /**
     * @dev Cancels a proposal that has not yet been executed.
     * @param targets The addresses of the contracts in the proposal.
     * @param values The values (in Wei) sent with each contract call.
     * @param calldatas The calldata for each contract call in the proposal.
     * @param descriptionHash The hash of the proposal's description.
     * @return The ID of the canceled proposal.
     */
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (uint256)
    {
        return
            GovernorTimelockControlUpgradeable._cancel(
                targets,
                values,
                calldatas,
                descriptionHash
            );
    }

    /**
     * @dev Returns the executor address for proposal execution.
     * Combines the base and timelock control override implementations.
     */
    function _executor()
        internal
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (address)
    {
        return super._executor();
    }

    /**
     * @dev Executes operations for a proposal after it is approved.
     * @param proposalId The ID of the proposal being executed.
     * @param targets The addresses of the contracts to call.
     * @param values The values (in Wei) sent with the calls.
     * @param calldatas The calldata for each contract call.
     * @param descriptionHash The hash of the proposal's description.
     */
    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
    {
        super._executeOperations(
            proposalId,
            targets,
            values,
            calldatas,
            descriptionHash
        );
    }

    /**
     * @dev Queues the operations defined in a proposal after it passes the vote.
     * The operations will be executed after the timelock delay.
     * This function overrides the base implementations to queue the proposal actions in the timelock.
     * @param proposalId The ID of the proposal to queue.
     * @param targets The addresses of the contracts to be called by the proposal.
     * @param values The values (in Wei) to send with the calls.
     * @param calldatas The calldata to be passed to each contract call.
     * @param descriptionHash The hashed description of the proposal.
     * @return The timestamp when the proposal will be executable after the timelock delay.
     */
    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(GovernorTimelockControlUpgradeable, GovernorUpgradeable)
        returns (uint48)
    {
        return
            super._queueOperations(
                proposalId,
                targets,
                values,
                calldatas,
                descriptionHash
            );
    }

    /**
     * @dev Determines if a proposal requires queuing before execution.
     * In this implementation, all proposals require queuing after passing.
     * This function overrides the base implementations and always returns true.
     * @return A boolean indicating that proposals always need to be queued (true).
     */
    function proposalNeedsQueuing(
        uint256
    )
        public
        pure
        override(GovernorTimelockControlUpgradeable, GovernorUpgradeable)
        returns (bool)
    {
        return true;
    }
}
