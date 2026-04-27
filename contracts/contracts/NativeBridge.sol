// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ICrossL2ProverV2.sol";

/**
 * @title NativeBridge
 * @notice Cross-chain native token bridge using Polymer's CrossL2Prover infrastructure.
 *
 * Flow:
 * 1. User calls deposit() on source chain, locking native tokens.
 *    Contract emits Deposited event with all bridge parameters.
 * 2. Backend fetches the Polymer proof for that transaction via the Prove API.
 * 3. User calls claim() on destination chain with the proof bytes.
 *    Contract verifies the proof via ICrossL2ProverV2 and releases tokens.
 *
 * Deployed on both Base (chainId=8453) and Plume (chainId=98866).
 * The CrossL2Prover contract is at 0x95ccEAE71605c5d97A0AC0EA13013b058729d075 on all mainnet chains.
 */
contract NativeBridge {
    // ============ Events ============

    /// @notice Emitted when a user deposits native tokens to bridge to the dest chain.
    /// @param sender The address that initiated the deposit
    /// @param recipient The address on the destination chain that will receive the tokens
    /// @param amount The amount of native tokens deposited (in wei)
    /// @param nonce A unique nonce for this deposit (to prevent replay)
    /// @param destChainId The destination chain ID
    event Deposited(
        address indexed sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint32 destChainId
    );

    /// @notice Emitted when a claim is successfully processed on the destination chain.
    event Claimed(
        address indexed recipient,
        uint256 amount,
        uint256 nonce,
        uint32 srcChainId,
        bytes32 indexed srcTxProofHash
    );

    // ============ State ============

    /// @notice The Polymer CrossL2Prover contract (same address on all mainnet chains)
    ICrossL2ProverV2 public immutable prover;

    /// @notice The peer bridge contract address on the other chain
    address public peerBridge;

    /// @notice The chain ID of the peer chain
    uint32 public immutable peerChainId;

    /// @notice The owner/admin of this contract
    address public owner;

    /// @notice Incrementing nonce for outbound deposits
    uint256 public depositNonce;

    /// @notice Tracks which nonces have already been claimed to prevent replay attacks
    mapping(uint256 => bool) public claimedNonces;

    /// @notice The event signature for the Deposited event
    bytes32 public constant DEPOSITED_EVENT_SIG = keccak256(
        "Deposited(address,address,uint256,uint256,uint32)"
    );

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "NativeBridge: not owner");
        _;
    }

    // ============ Constructor ============

    /**
     * @param _prover Address of the Polymer CrossL2Prover contract
     * @param _peerBridge Address of the bridge contract on the peer chain (can be set later)
     * @param _peerChainId Chain ID of the peer chain
     */
    constructor(address _prover, address _peerBridge, uint32 _peerChainId) {
        require(_prover != address(0), "NativeBridge: zero prover");
        prover = ICrossL2ProverV2(_prover);
        peerBridge = _peerBridge;
        peerChainId = _peerChainId;
        owner = msg.sender;
    }

    // ============ Admin ============

    /**
     * @notice Update the peer bridge address (only needed after both contracts are deployed)
     */
    function setPeerBridge(address _peerBridge) external onlyOwner {
        require(_peerBridge != address(0), "NativeBridge: zero address");
        peerBridge = _peerBridge;
    }

    /**
     * @notice Transfer contract ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "NativeBridge: zero address");
        owner = newOwner;
    }

    /**
     * @notice Emergency withdrawal by owner (safety mechanism)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "NativeBridge: insufficient balance");
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "NativeBridge: transfer failed");
    }

    // ============ Core Bridge Functions ============

    /**
     * @notice Deposit native tokens to bridge to the peer chain.
     * @param recipient The address on the destination chain to receive the tokens
     */
    function deposit(address recipient) external payable {
        require(msg.value > 0, "NativeBridge: zero amount");
        require(recipient != address(0), "NativeBridge: zero recipient");
        require(peerBridge != address(0), "NativeBridge: peer not set");

        uint256 nonce = depositNonce++;

        emit Deposited(msg.sender, recipient, msg.value, nonce, peerChainId);
    }

    /**
     * @notice Claim tokens on this chain using a Polymer proof of a Deposited event on the peer chain.
     * @param proof The hex-encoded proof bytes from the Polymer Prove API
     */
    function claim(bytes calldata proof) external {
        require(peerBridge != address(0), "NativeBridge: peer not set");

        (
            uint32 srcChainId,
            address emittingContract,
            bytes memory topics,
            bytes memory unindexedData
        ) = prover.validateEvent(proof);

        // Verify the event came from the correct chain and contract
        require(srcChainId == peerChainId, "NativeBridge: wrong source chain");
        require(emittingContract == peerBridge, "NativeBridge: wrong emitter");

        // Verify the event is a Deposited event
        require(topics.length >= 32, "NativeBridge: invalid topics");
        bytes32 eventSig;
        bytes32 senderTopic;
        assembly {
            eventSig := mload(add(topics, 32))
            senderTopic := mload(add(topics, 64))
        }
        require(eventSig == DEPOSITED_EVENT_SIG, "NativeBridge: wrong event");

        // Decode the sender address from topics[1] (indexed param)
        require(topics.length >= 64, "NativeBridge: missing sender topic");
        address sender = address(uint160(uint256(senderTopic)));

        // Decode non-indexed params: (address recipient, uint256 amount, uint256 nonce, uint32 destChainId)
        (address recipient, uint256 amount, uint256 nonce, uint32 destChainId) =
            abi.decode(unindexedData, (address, uint256, uint256, uint32));

        // Verify this deposit was intended for this chain
        require(destChainId == block.chainid, "NativeBridge: wrong dest chain");

        // Prevent replay attacks
        require(!claimedNonces[nonce], "NativeBridge: already claimed");
        claimedNonces[nonce] = true;

        // Verify we have enough balance
        require(address(this).balance >= amount, "NativeBridge: insufficient liquidity");

        // Release tokens to recipient (checks-effects-interactions)
        bytes32 proofHash = keccak256(proof);
        emit Claimed(recipient, amount, nonce, srcChainId, proofHash);

        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "NativeBridge: transfer failed");

        sender; // reference sender to avoid unused variable warning
    }

    /**
     * @notice Get the current contract balance (available liquidity)
     */
    function liquidity() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Receive ETH directly (adds liquidity)
     */
    receive() external payable {}
}
