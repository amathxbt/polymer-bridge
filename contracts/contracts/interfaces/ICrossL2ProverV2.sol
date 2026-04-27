// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ICrossL2ProverV2
 * @author Polymer Labs
 * @notice A contract that can prove cross-chain events. Since Polymer is an aggregator
 * of many chains' states, this contract can prove any arbitrary events on counterparty chains.
 */
interface ICrossL2ProverV2 {
    /**
     * @notice Validates a log proof and returns the event details.
     * @param proof The proof bytes returned from the Polymer Prove API (base64 decoded to hex)
     * @return chainId The chain ID where the event was emitted
     * @return emittingContract The address of the contract that emitted the event
     * @return topics Raw bytes of all event topics concatenated (each 32 bytes)
     * @return unindexedData ABI-encoded non-indexed event parameters
     */
    function validateEvent(bytes calldata proof)
        external
        view
        returns (
            uint32 chainId,
            address emittingContract,
            bytes memory topics,
            bytes memory unindexedData
        );
}
