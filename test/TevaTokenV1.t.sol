// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
// import "forge-std/console.sol";
import "../contracts/token/TevaTokenV1.sol"; // Adjust the path as necessary

contract TevaTokenV1Test is Test {
    TevaTokenV1 private token;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error ERC20ExceededCap(uint256 increasedSupply, uint256 cap);
    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);
    error DelegateSignatureIsInvalid();
    error ERC2612InvalidSigner(address signer, address owner);

    /*//////////////////////////////////////////////////////////////
                        Teva Token ROLES
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/
    // Admin Address
    address ADMIN = address(this);
    // Voters ALICE, BOD And CHARLE
    address constant MINTER =
        address(0x7ef27552FBf9f20Cb95b4722EFa9015F9fE9e7C5);
    address constant BURNER =
        address(0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB);
    address constant USER = address(0x0000000000000000000000000000000000008001);
    uint256 constant PRIVATE_KEY = 0xA11CE;
    uint256 public constant MAX_CAP = 4_000_000_000 * 10 ** 18; // 4 billion tokens with 18 decimals

    /// @notice Type hash used when encoding data for `delegateOnBehalf` calls.
    bytes32 public constant DELEGATION_TYPEHASH =
        keccak256(
            "Delegation(address owner,address delegatee,uint256 nonce,uint256 expiry)"
        );
    bytes32 constant PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    /*//////////////////////////////////////////////////////////////
                SETUP
    //////////////////////////////////////////////////////////////*/
    function setUp() public {
        // Deploy the token
        token = new TevaTokenV1();
        token.initialize();
    }

    /*//////////////////////////////////////////////////////////////
                         TEST INITIALIZATION 
    //////////////////////////////////////////////////////////////*/
    function testInitialization() public view {
        assertEq(token.name(), "Tevaera");
        assertEq(token.symbol(), "TEVA");
        assertEq(token.totalSupply(), 0);
        assertEq(token.MAX_CAP(), 4_000_000_000 * 10 ** 18);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), ADMIN));
        assertTrue(token.hasRole(token.MINTER_ADMIN_ROLE(), ADMIN));
        assertTrue(token.hasRole(token.BURNER_ADMIN_ROLE(), ADMIN));
    }

    /*//////////////////////////////////////////////////////////////
                          MINTING TEST CASE 
    //////////////////////////////////////////////////////////////*/
    function testMinting() public {
        // Grant the MINTER_ROLE to the MINTER address
        token.grantRole(MINTER_ROLE, MINTER);

        // Mint tokens
        vm.prank(MINTER);
        token.mint(USER, 100 * 10 ** 18);

        assertEq(token.balanceOf(USER), 100 * 10 ** 18);
        assertEq(token.totalSupply(), 100 * 10 ** 18);
    }

    function testMintingBeyondCapFails() public {
        // Grant the MINTER_ROLE to the MINTER address
        token.grantRole(MINTER_ROLE, MINTER);

        // Mint to reach the cap
        vm.prank(MINTER);
        uint256 increasingSupply = 1 * 10 ** 18;
        token.mint(USER, MAX_CAP);

        // Trying to mint more than the cap should fail
        vm.prank(MINTER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20ExceededCap.selector,
                MAX_CAP + increasingSupply,
                MAX_CAP
            )
        );
        token.mint(USER, 1 * 10 ** 18);
    }

    function testMintingWithoutRoleFails() public {
        // Attempting to burn without the BURNER_ROLE should fail
        vm.prank(USER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControlUnauthorizedAccount.selector,
                USER,
                MINTER_ROLE
            )
        );
        token.mint(USER, 50 * 10 ** 18);
    }

    /*//////////////////////////////////////////////////////////////
                        BURNING TEST CASE 
    //////////////////////////////////////////////////////////////*/
    function testBurning() public {
        // Grant roles for minting and burning
        token.grantRole(MINTER_ROLE, MINTER);
        token.grantRole(BURNER_ROLE, BURNER);

        // Mint tokens
        vm.prank(MINTER);
        token.mint(USER, 100 * 10 ** 18);
        assertEq(token.balanceOf(USER), 100 * 10 ** 18);

        // Burn tokens
        vm.prank(BURNER);
        token.burn(USER, 50 * 10 ** 18);

        assertEq(token.balanceOf(USER), 50 * 10 ** 18);
        assertEq(token.totalSupply(), 50 * 10 ** 18);
    }

    function testBurningWithoutRoleFails() public {
        // Grant only the MINTER_ROLE
        token.grantRole(MINTER_ROLE, MINTER);

        // Mint tokens
        vm.prank(MINTER);
        token.mint(USER, 100 * 10 ** 18);

        // Attempting to burn without the BURNER_ROLE should fail
        vm.prank(USER);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControlUnauthorizedAccount.selector,
                USER,
                BURNER_ROLE
            )
        );
        token.burn(USER, 50 * 10 ** 18);
    }

    /*//////////////////////////////////////////////////////////////
                      ROLE MANAGEMENT TEST CASE 
    //////////////////////////////////////////////////////////////*/
    function testRoleManagement() public {
        // Grant MINTER_ROLE
        token.grantRole(MINTER_ROLE, MINTER);
        assertTrue(token.hasRole(MINTER_ROLE, MINTER));

        // Revoke MINTER_ROLE
        token.revokeRole(MINTER_ROLE, MINTER);
        assertFalse(token.hasRole(MINTER_ROLE, MINTER));

        // Grant BURNER_ROLE
        token.grantRole(BURNER_ROLE, MINTER);
        assertTrue(token.hasRole(BURNER_ROLE, MINTER));

        // Revoke MINTER_ROLE
        token.revokeRole(BURNER_ROLE, MINTER);
        assertFalse(token.hasRole(BURNER_ROLE, MINTER));
    }

    /*//////////////////////////////////////////////////////////////
                         DELEGATION TEST CASE 
    //////////////////////////////////////////////////////////////*/
    function testDelegation() public {
        // Grant MINTER_ROLE
        token.grantRole(token.MINTER_ROLE(), MINTER);

        // Mint tokens
        vm.prank(MINTER);
        token.mint(USER, 100 * 10 ** 18);

        // Delegate votes
        address delegatee = address(0x4);

        // User delegates votes to delegatee
        vm.prank(USER);
        token.delegate(delegatee);

        assertEq(token.getVotes(delegatee), 100 * 10 ** 18);
    }

    /*///////////////////////////////////////////////////////////////////////
        DELEGATION ON BEHALF TEST CASE ON EIP1271(SMART WALLET),ECDSA(EOA)
    ////////////////////////////////////////////////////////////////////////*/
    function testRevertIfExpiredSignatureDelegateOnBehalf(
        uint256 _signerPrivateKey,
        uint256 _amount,
        address _delegatee,
        uint256 _expiry
    ) public {
        vm.assume(_delegatee != address(0));
        _expiry = bound(_expiry, 0, block.timestamp - 1);
        _signerPrivateKey = bound(_signerPrivateKey, 1, 100e18);
        address _signer = vm.addr(_signerPrivateKey);
        _amount = bound(_amount, 0, MAX_CAP);

        token.grantRole(MINTER_ROLE, MINTER);
        vm.prank(MINTER);
        token.mint(_signer, _amount);

        // verify the owner has the expected balance
        assertEq(token.balanceOf(_signer), _amount);

        // verify the signer has no delegate
        assertEq(token.delegates(_signer), address(0));

        vm.expectRevert(
            abi.encodeWithSelector(
                TevaTokenV1.DelegateSignatureExpired.selector,
                _expiry
            )
        );
        token.delegateOnBehalf(_signer, _delegatee, _expiry, "");
    }

    function testPerformsDelegationByCallingDelegateOnBehalfECDSA(
        uint256 _signerPrivateKey,
        uint256 _amount,
        address _delegatee,
        uint256 _expiry
    ) public {
        vm.assume(_delegatee != address(0));
        _expiry = bound(_expiry, block.timestamp, type(uint256).max);
        _signerPrivateKey = bound(_signerPrivateKey, 1, 100e18);
        address _signer = vm.addr(_signerPrivateKey);
        _amount = bound(_amount, 0, MAX_CAP);

        token.grantRole(MINTER_ROLE, MINTER);
        vm.prank(MINTER);
        token.mint(_signer, _amount);

        // verify the owner has the expected balance
        assertEq(token.balanceOf(_signer), _amount);

        bytes32 _message = keccak256(
            abi.encode(
                DELEGATION_TYPEHASH,
                _signer,
                _delegatee,
                token.nonces(_signer),
                _expiry
            )
        );

        bytes32 _messageHash = keccak256(
            abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), _message)
        );

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(
            _signerPrivateKey,
            _messageHash
        );

        // verify the signer has no delegate
        assertEq(token.delegates(_signer), address(0));

        token.delegateOnBehalf(
            _signer,
            _delegatee,
            _expiry,
            abi.encodePacked(_r, _s, _v)
        );

        // verify the signer has delegate
        assertEq(token.delegates(_signer), _delegatee);
    }

    function testPerformsDelegationByCallingDelegateOnBehalfEIP1271(
        uint256 _signerPrivateKey,
        uint256 _amount,
        address _delegatee,
        uint256 _expiry
    ) public {
        vm.assume(_delegatee != address(0));
        _expiry = bound(_expiry, block.timestamp, type(uint256).max);
        _signerPrivateKey = bound(_signerPrivateKey, 1, 100e18);
        address _signer = vm.addr(_signerPrivateKey);
        _amount = bound(_amount, 0, MAX_CAP);

        token.grantRole(MINTER_ROLE, MINTER);
        vm.prank(MINTER);
        token.mint(_signer, _amount);

        // verify the owner has the expected balance
        assertEq(token.balanceOf(_signer), _amount);

        bytes32 _message = keccak256(
            abi.encode(
                DELEGATION_TYPEHASH,
                _signer,
                _delegatee,
                token.nonces(_signer),
                _expiry
            )
        );

        bytes32 _messageHash = keccak256(
            abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), _message)
        );

        // verify the signer has no delegate
        assertEq(token.delegates(_signer), address(0));

        vm.mockCall(
            _signer,
            abi.encodeWithSelector(
                IERC1271.isValidSignature.selector,
                _messageHash
            ),
            abi.encode(IERC1271.isValidSignature.selector)
        );

        token.delegateOnBehalf(_signer, _delegatee, _expiry, "");

        // verify the signer has delegate
        assertEq(token.delegates(_signer), _delegatee);
    }

    function testRevertIfInvalidSignature() public {
        // Grant the MINTER_ROLE to the minter address
        token.grantRole(token.MINTER_ROLE(), MINTER);

        // Mint tokens to the user
        vm.prank(MINTER);
        token.mint(USER, 100 * 10 ** 18);

        // Prepare to delegate votes
        address delegatee = address(0x4);
        uint256 expiry = block.timestamp + 1 days;
        bytes32 delegateHash = keccak256(
            abi.encode(
                token.DELEGATION_TYPEHASH(),
                USER,
                delegatee,
                token.nonces(USER),
                expiry
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIVATE_KEY, delegateHash);

        // Delegate votes on behalf of the user
        vm.prank(USER);
        vm.expectRevert(DelegateSignatureIsInvalid.selector);
        token.delegateOnBehalf(
            USER,
            delegatee,
            expiry,
            abi.encodePacked(r, s, v)
        );
    }

    /*//////////////////////////////////////////////////////////////
                         PERMIT TEST CASE 
    //////////////////////////////////////////////////////////////*/
    function testPerformsTheApprovalByCallingPermitThenPerformsTransfer(
        uint256 _ownerPrivateKey,
        uint256 _amount,
        address _spender,
        address _receiver,
        uint256 _deadline
    ) public {
        vm.assume(_spender != address(0) && _receiver != address(0));
        _deadline = bound(_deadline, block.timestamp + 1, type(uint256).max);
        _ownerPrivateKey = bound(_ownerPrivateKey, 1, 100e18);
        address _owner = vm.addr(_ownerPrivateKey);
        _amount = bound(_amount, 0, MAX_CAP);

        token.grantRole(MINTER_ROLE, MINTER);
        vm.prank(MINTER);
        token.mint(_owner, _amount);

        // verify the owner has the expected balance
        assertEq(token.balanceOf(_owner), _amount);

        bytes32 _message = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                _owner,
                _spender,
                _amount,
                token.nonces(_owner),
                _deadline
            )
        );

        bytes32 _messageHash = keccak256(
            abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), _message)
        );
        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(
            _ownerPrivateKey,
            _messageHash
        );

        vm.prank(_spender);
        token.permit(_owner, _spender, _amount, _deadline, _v, _r, _s);

        vm.prank(_spender);
        token.transferFrom(_owner, _receiver, _amount);

        // verify the receiver has the expected balance
        assertEq(token.balanceOf(_receiver), _amount);

        // verify the owner has the zero balance
        assertEq(token.balanceOf(_owner), 0);
    }

    function testRevertIfThePermitSignatureIsInvalid(
        address _notOwner,
        uint256 _ownerPrivateKey,
        uint256 _amount,
        address _spender,
        address _receiver,
        uint256 _deadline
    ) public {
        vm.assume(
            _spender != address(0) &&
                _receiver != address(0) &&
                _notOwner != address(0)
        );

        _deadline = bound(_deadline, block.timestamp + 1, type(uint256).max);
        _ownerPrivateKey = bound(_ownerPrivateKey, 1, 100e18);
        address _owner = vm.addr(_ownerPrivateKey);
        vm.assume(_notOwner != _owner);
        _amount = bound(_amount, 0, MAX_CAP);

        token.grantRole(MINTER_ROLE, MINTER);
        vm.prank(MINTER);
        token.mint(_owner, _amount);

        // verify the owner has the expected balance
        assertEq(token.balanceOf(_owner), _amount);

        bytes32 _message = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                _notOwner,
                _spender,
                _amount,
                token.nonces(_notOwner),
                _deadline
            )
        );

        bytes32 _messageHash = keccak256(
            abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), _message)
        );
        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(
            _ownerPrivateKey,
            _messageHash
        );

        // verify the permit signature is invalid
        vm.prank(_spender);
        vm.expectRevert(
            abi.encodeWithSelector(
                ERC2612InvalidSigner.selector,
                _owner,
                _notOwner
            )
        );
        token.permit(_notOwner, _spender, _amount, _deadline, _v, _r, _s);
    }
}
