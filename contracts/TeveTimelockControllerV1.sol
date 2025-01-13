// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title TeveTimelockControllerV1
 * @dev This contract is an implementation of a timelock controller
 * that manages delays for governance proposals. It extends the
 * TimelockControllerUpgradeable from OpenZeppelin, allowing for
 * upgradeable functionalities.
 */
contract TeveTimelockControllerV1 is
    Initializable,
    TimelockControllerUpgradeable,
    ReentrancyGuardUpgradeable
{
    /**
     * @dev Initializes the contract with a minimum delay,
     * proposers, and executors.
     * @param minDelay The minimum delay (in seconds) before
     * proposals can be executed after being queued.
     * @param proposers An array of addresses that are allowed
     * to propose transactions.
     * @param executors An array of addresses that are allowed
     * to execute queued transactions.
     */
    function initialize(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors
    ) public initializer {
        // Call the initialize function of the TimelockControllerUpgradeable
        __TimelockController_init(minDelay, proposers, executors, msg.sender);
        __ReentrancyGuard_init();
    }

    /**
     * @dev Executes a transaction that was previously queued.
     * @param target The address of the contract to execute.
     * @param value The value to send with the transaction.
     * @param payload The calldata to execute.
     * @param predecessor The predecessor proposal id.
     * @param salt The salt used to prevent replay attacks.
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata payload,
        bytes32 predecessor,
        bytes32 salt
    )
        public
        payable
        virtual
        override
        onlyRoleOrOpenRole(EXECUTOR_ROLE)
        nonReentrant
    {
        // Call the parent implementation
        super.execute(target, value, payload, predecessor, salt);
    }

    /**
     * @dev Executes multiple transactions that were previously queued.
     * @param targets The addresses of the contracts to execute.
     * @param values The values to send with each transaction.
     * @param payloads The calldata to execute for each transaction.
     * @param predecessor The predecessor proposal id.
     * @param salt The salt used to prevent replay attacks.
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    )
        public
        payable
        virtual
        override
        onlyRoleOrOpenRole(EXECUTOR_ROLE)
        nonReentrant
    {
        super.executeBatch(targets, values, payloads, predecessor, salt);
    }
}
