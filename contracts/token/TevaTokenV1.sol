// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract TevaTokenV1 is
    Initializable,
    ERC20BurnableUpgradeable,
    AccessControlUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    ERC20CappedUpgradeable
{
    using SignatureChecker for address;

    /// @dev The unique identifier constant used to represent the administrator of the minter role.
    /// An address that has this role may grant or revoke the minter role from other addresses.
    /// This role itself may be granted or revoked by the DEFAULT_ADMIN_ROLE.
    bytes32 public constant MINTER_ADMIN_ROLE = keccak256("MINTER_ADMIN_ROLE");

    /// @dev The unique identifier constant used to represent the administrator of the burner role.
    /// An address that has this role may grant or revoke the burner role from other addresses.
    /// This role itself may be granted or revoked by the DEFAULT_ADMIN_ROLE.
    bytes32 public constant BURNER_ADMIN_ROLE = keccak256("BURNER_ADMIN_ROLE");

    /// @dev The unique identifier constant used to represent the minter role.
    /// An address with this role may call the `mint` method to create new tokens and assign them
    /// to a specified address. This role may be granted or revoked by the MINTER_ADMIN_ROLE.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev The unique identifier constant used to represent the burner role.
    /// An address with this role may call the `burn` method to destroy tokens held by a given address,
    /// effectively reducing the total supply. This role may be granted or revoked by the BURNER_ADMIN_ROLE.
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @dev The maximum cap for the token's total supply is set to 4 billion tokens, with 18 decimals.
    uint256 public constant MAX_CAP = 4_000_000_000 * 10 ** 18;

    /// @dev Type hash used when encoding data for `delegateOnBehalf` calls,
    /// following the EIP-712 standard for structured data hashing and signing.
    bytes32 public constant DELEGATION_HASH =
        keccak256(
            "Delegation(address owner,address delegatee,uint256 nonce,uint256 expiry)"
        );

    /// @dev Error thrown when a signature for delegating voting rights has expired.
    error DelegateSignatureExpired(uint256 expiry);

    /// @dev Error thrown when a provided signature for delegating voting rights is invalid.
    error DelegateSignatureIsInvalid();

    /// @dev Zero Address
    error ZeroAddress();

    /// @dev The initializer function that replaces the constructor for upgradeable contracts.
    /// It initializes the token with the name "Tevaera" and symbol "Teva",
    /// along with setting up the roles and initializing inherited modules.
    function initialize() public initializer {
        __ERC20_init("Tevaera", "TEVA");
        __ERC20Burnable_init();
        __ERC20Votes_init();
        __ERC20Permit_init("Tevaera");
        __ERC20Capped_init(MAX_CAP);

        // Granting initial roles to the contract deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ADMIN_ROLE, msg.sender);
        _grantRole(BURNER_ADMIN_ROLE, msg.sender);

        // Setting up role hierarchies: MINTER_ROLE and BURNER_ROLE admin control is granted to specific roles.
        _setRoleAdmin(MINTER_ROLE, MINTER_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, BURNER_ADMIN_ROLE);
    }

    /// @dev Mint new tokens to a specified address.
    /// Only accounts with the MINTER_ROLE can call this function.
    /// @param to The address that will receive the minted tokens.
    /// @param amount The amount of tokens to be minted.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    /// @dev Burn tokens from a specified address.
    /// Only accounts with the BURNER_ROLE can call this function.
    /// @param from The address from which the tokens will be burned.
    /// @param amount The amount of tokens to be burned.
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (from == address(0)) revert ZeroAddress();
        _burn(from, amount);
    }

    /// @dev Overrides the `clock` function to return the current block timestamp.
    /// This makes the clock based on time rather than block numbers.
    function clock() public view virtual override returns (uint48) {
        return SafeCast.toUint48(block.timestamp);
    }

    /// @dev Overrides the `CLOCK_MODE` function to indicate that the clock is based on timestamps.
    /// Ensures the consistency of the clock system.
    function CLOCK_MODE() public view virtual override returns (string memory) {
        if (clock() != SafeCast.toUint48(block.timestamp)) {
            revert ERC6372InconsistentClock();
        }
        return "mode=timestamp";
    }

    /// @dev Internal function to handle token updates during transfers.
    /// It overrides the `_update` function from multiple inherited contracts to
    /// ensure consistent behavior.
    /// @param from The address sending the tokens.
    /// @param to The address receiving the tokens.
    /// @param value The amount of tokens being transferred.
    function _update(
        address from,
        address to,
        uint256 value
    )
        internal
        override(
            ERC20CappedUpgradeable,
            ERC20VotesUpgradeable,
            ERC20Upgradeable
        )
    {
        // Disable transfers
        revert("All transfers are disabled permanently");
    }

    /// @dev Overrides the `nonces` function to resolve potential conflicts between
    /// ERC20PermitUpgradeable and ERC20VotesUpgradeable.
    /// @param owner The address for which the nonce is queried.
    /// @return The current nonce for the owner address.
    function nonces(
        address owner
    )
        public
        view
        override(NoncesUpgradeable, ERC20PermitUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    /// @dev Delegates votes from the signer to a delegatee using an EIP-1271/ECDSA signature.
    /// This function is used to allow delegations via signature.
    /// @param _signer The address of the token holder who is delegating their voting power.
    /// @param _delegatee The address to which voting power is being delegated.
    /// @param _expiry The timestamp at which the signed message expires.
    /// @param _signature The signature authorizing the delegation.
    function delegateOnBehalf(
        address _signer,
        address _delegatee,
        uint256 _expiry,
        bytes calldata _signature
    ) external {
        if (block.timestamp > _expiry) {
            revert DelegateSignatureExpired(_expiry);
        }

        // Validate the signature using the EIP-712 typed data hashing.
        bool _isSignatureValid = _signer.isValidSignatureNow(
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        DELEGATION_HASH,
                        _signer,
                        _delegatee,
                        _useNonce(_signer),
                        _expiry
                    )
                )
            ),
            _signature
        );

        if (!_isSignatureValid) {
            revert DelegateSignatureIsInvalid();
        }

        // Delegate the voting power to the specified delegatee.
        _delegate(_signer, _delegatee);
    }
}
