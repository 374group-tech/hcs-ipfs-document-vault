// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PinFeeCollector
 * @notice Thin non-custodial pin-fee sink for the HCS-IPFS document vault.
 * @dev Payer sends HBAR (native) or an HTS/ERC-20 style token directly to the
 *      configured treasury. The contract never holds user funds as an intermediary
 *      hop beyond the atomic call: value/tokens move payer → treasury in one tx.
 *
 *      Optional path when PIN_TOKEN_ID is set (HIP-336 style allowances off-chain
 *      via the Hedera SDK CryptoApproveAllowance + CryptoTransfer). This contract
 *      covers the on-chain EVM pin fee for HBAR or IERC20-compatible tokens.
 */
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PinFeeCollector {
    address public immutable TREASURY;
    address public owner;

    event PinPaid(
        address indexed payer,
        address indexed token,
        uint256 amount,
        string cid,
        bytes32 sha256Hash
    );
    event OwnershipTransferred(address indexed previous, address indexed next);

    error ZeroAddress();
    error InvalidAmount();
    error TransferFailed();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address treasury_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        TREASURY = treasury_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Pay pin fee in native HBAR (tinybars as wei-equivalent on Hedera EVM).
     * @param cid IPFS CID being pinned/attested (informational, emitted in event).
     * @param sha256Hash Document content hash.
     */
    function payPinHbar(string calldata cid, bytes32 sha256Hash) external payable {
        if (msg.value == 0) revert InvalidAmount();
        _forwardHbar(msg.sender, msg.value, cid, sha256Hash);
    }

    /**
     * @notice Pay pin fee in an IERC20 / HTS-as-ERC20 token. Caller must approve
     *         this contract for `amount` first (standard ERC-20 allowance).
     *         Tokens move payer → treasury in one transferFrom; no custody.
     */
    function payPinToken(
        address token,
        uint256 amount,
        string calldata cid,
        bytes32 sha256Hash
    ) external {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        bool ok = IERC20Minimal(token).transferFrom(msg.sender, TREASURY, amount);
        if (!ok) revert TransferFailed();
        emit PinPaid(msg.sender, token, amount, cid, sha256Hash);
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, next);
        owner = next;
    }

    receive() external payable {
        revert InvalidAmount();
    }

    function _forwardHbar(
        address payer,
        uint256 amount,
        string memory cid,
        bytes32 sha256Hash
    ) internal {
        (bool ok, ) = payable(TREASURY).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit PinPaid(payer, address(0), amount, cid, sha256Hash);
    }
}
