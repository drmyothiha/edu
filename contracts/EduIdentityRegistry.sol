// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EduIdentityRegistry
 * @notice Lightweight, immutable anchor registry for Myanmar EduPlatform student credentials.
 * @dev Stores 32-byte Merkle Roots of student ID batches and revocation bitmaps.
 * ZERO personal identifiable information (PII) is stored on-chain.
 */
contract EduIdentityRegistry {
    address public owner;
    
    // Batch struct
    struct AnchorBatch {
        bytes32 merkleRoot;
        uint32 batchSize;
        uint64 timestamp;
        string network;
        address anchoredBy;
    }

    // Mapping from Merkle Root => Anchor metadata
    mapping(bytes32 => AnchorBatch) public batches;
    
    // List of all anchored Merkle Roots in order
    bytes32[] public rootList;

    // Authorized school issuers mapping
    mapping(address => bool) public authorizedIssuers;

    // Revocation registry: credentialHash => true if revoked
    mapping(bytes32 => bool) public isRevoked;
    mapping(bytes32 => string) public revocationReasons;

    // Events
    event MerkleRootAnchored(bytes32 indexed merkleRoot, uint32 batchSize, address indexed anchoredBy, uint64 timestamp);
    event CredentialRevoked(bytes32 indexed credentialHash, string reason, address indexed revokedBy);
    event IssuerAuthorized(address indexed issuer, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "EduRegistry: caller is not the owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedIssuers[msg.sender], "EduRegistry: unauthorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    function setIssuerStatus(address issuer, bool status) external onlyOwner {
        authorizedIssuers[issuer] = status;
        emit IssuerAuthorized(issuer, status);
    }

    /**
     * @notice Anchors a batch of student credentials via their Merkle Root.
     * @param merkleRoot The 32-byte Merkle root representing up to 10,000 students.
     * @param batchSize The number of credentials in this batch.
     */
    function anchorMerkleRoot(bytes32 merkleRoot, uint32 batchSize) external onlyAuthorized {
        require(merkleRoot != bytes32(0), "EduRegistry: invalid root");
        require(batches[merkleRoot].timestamp == 0, "EduRegistry: root already anchored");

        batches[merkleRoot] = AnchorBatch({
            merkleRoot: merkleRoot,
            batchSize: batchSize,
            timestamp: uint64(block.timestamp),
            network: "Polygon",
            anchoredBy: msg.sender
        });

        rootList.push(merkleRoot);
        emit MerkleRootAnchored(merkleRoot, batchSize, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Revoke a compromised or graduated credential.
     */
    function revokeCredential(bytes32 credentialHash, string calldata reason) external onlyAuthorized {
        require(credentialHash != bytes32(0), "EduRegistry: invalid hash");
        isRevoked[credentialHash] = true;
        revocationReasons[credentialHash] = reason;
        emit CredentialRevoked(credentialHash, reason, msg.sender);
    }

    /**
     * @notice Verifies whether a credential leaf hash belongs to an anchored Merkle root.
     */
    function verifyCredentialProof(
        bytes32 leafHash,
        bytes32 merkleRoot,
        bytes32[] calldata proof
    ) external view returns (bool valid, bool revoked, uint64 anchorTime) {
        AnchorBatch memory b = batches[merkleRoot];
        if (b.timestamp == 0) {
            return (false, false, 0);
        }

        bool revokedStatus = isRevoked[leafHash];

        // Recompute Merkle root from proof
        bytes32 computedHash = leafHash;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = sha256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = sha256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return (computedHash == merkleRoot, revokedStatus, b.timestamp);
    }

    function totalBatches() external view returns (uint256) {
        return rootList.length;
    }
}
