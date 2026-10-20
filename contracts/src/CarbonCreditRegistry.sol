// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CarbonCreditRegistry
/// @notice A small registry for evidence-backed carbon credit issuance and retirement.
/// @dev The access-control and pause primitives intentionally mirror the core behavior
///      of OpenZeppelin's AccessControl and Pausable contracts without importing them.
contract CarbonCreditRegistry {
    bytes32 public constant DEFAULT_ADMIN_ROLE = bytes32(0);
    bytes32 public constant EVIDENCE_ROLE = keccak256("EVIDENCE_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant RETIRER_ROLE = keccak256("RETIRER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct EvidenceRecord {
        string uri;
        bytes32 contentHash;
        address registeredBy;
        uint256 registeredAt;
    }

    struct CreditBalance {
        uint256 issued;
        uint256 retired;
    }

    error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);
    error AccessControlBadConfirmation();
    error AlreadyExists(bytes32 identifier);
    error ArrayLengthMismatch();
    error DuplicateOperationId(bytes32 operationId);
    error EmptyBatch();
    error EnforcedPause();
    error ExpectedPause();
    error InsufficientCredits(bytes32 projectId, uint256 requested, uint256 available);
    error InvalidIdentifier();
    error InvalidQuantity();
    error UnknownEvidence(bytes32 evidenceId);
    error ZeroAddress();

    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event EvidenceRegistered(
        bytes32 indexed evidenceId,
        bytes32 indexed contentHash,
        string uri,
        address indexed registeredBy
    );
    event CreditsIssued(
        bytes32 indexed operationId,
        bytes32 indexed projectId,
        bytes32 indexed evidenceId,
        uint256 quantity,
        address issuer
    );
    event CreditsRetired(bytes32 indexed operationId, bytes32 indexed projectId, uint256 quantity, address retiree);
    event Paused(address account);
    event Unpaused(address account);

    mapping(bytes32 role => mapping(address account => bool)) private _roles;
    mapping(bytes32 role => bytes32 adminRole) private _roleAdmins;
    mapping(bytes32 evidenceId => EvidenceRecord record) private _evidence;
    mapping(bytes32 evidenceId => bool) public evidenceExists;
    mapping(bytes32 operationId => bool) public operationUsed;
    mapping(bytes32 projectId => CreditBalance balance) private _credits;
    bool private _paused;

    modifier onlyRole(bytes32 role) {
        _checkRole(role, msg.sender);
        _;
    }

    modifier whenNotPaused() {
        if (_paused) revert EnforcedPause();
        _;
    }

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();

        _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(EVIDENCE_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(RETIRER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, DEFAULT_ADMIN_ROLE);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EVIDENCE_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(RETIRER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Access control
    // -------------------------------------------------------------------------

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function getRoleAdmin(bytes32 role) public view returns (bytes32) {
        return _roleAdmins[role];
    }

    function grantRole(bytes32 role, address account) external onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) external onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    function renounceRole(bytes32 role, address callerConfirmation) external {
        if (callerConfirmation != msg.sender) revert AccessControlBadConfirmation();
        _revokeRole(role, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Evidence
    // -------------------------------------------------------------------------

    function registerEvidence(bytes32 evidenceId, string calldata uri, bytes32 contentHash)
        external
        onlyRole(EVIDENCE_ROLE)
        whenNotPaused
    {
        _registerEvidence(evidenceId, uri, contentHash);
    }

    function registerEvidenceBatch(
        bytes32[] calldata evidenceIds,
        string[] calldata uris,
        bytes32[] calldata contentHashes
    ) external onlyRole(EVIDENCE_ROLE) whenNotPaused {
        uint256 length = evidenceIds.length;
        if (length == 0) revert EmptyBatch();
        if (length != uris.length || length != contentHashes.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < length; ++i) {
            _registerEvidence(evidenceIds[i], uris[i], contentHashes[i]);
        }
    }

    function getEvidence(bytes32 evidenceId)
        external
        view
        returns (string memory uri, bytes32 contentHash, address registeredBy, uint256 registeredAt)
    {
        if (!evidenceExists[evidenceId]) revert UnknownEvidence(evidenceId);
        EvidenceRecord storage record = _evidence[evidenceId];
        return (record.uri, record.contentHash, record.registeredBy, record.registeredAt);
    }

    // -------------------------------------------------------------------------
    // Issuance and retirement
    // -------------------------------------------------------------------------

    function issueCredits(bytes32 operationId, bytes32 projectId, uint256 quantity, bytes32 evidenceId)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        _validateOperation(operationId);
        _validateProject(projectId);
        _validateQuantity(quantity);
        if (!evidenceExists[evidenceId]) revert UnknownEvidence(evidenceId);

        operationUsed[operationId] = true;
        _credits[projectId].issued += quantity;

        emit CreditsIssued(operationId, projectId, evidenceId, quantity, msg.sender);
    }

    function retireCredits(bytes32 operationId, bytes32 projectId, uint256 quantity)
        external
        onlyRole(RETIRER_ROLE)
        whenNotPaused
    {
        _validateOperation(operationId);
        _validateProject(projectId);
        _validateQuantity(quantity);

        CreditBalance storage balance = _credits[projectId];
        uint256 available = balance.issued - balance.retired;
        if (quantity > available) revert InsufficientCredits(projectId, quantity, available);

        operationUsed[operationId] = true;
        balance.retired += quantity;

        emit CreditsRetired(operationId, projectId, quantity, msg.sender);
    }

    function getCreditBalance(bytes32 projectId)
        external
        view
        returns (uint256 issued, uint256 retired, uint256 available)
    {
        CreditBalance storage balance = _credits[projectId];
        issued = balance.issued;
        retired = balance.retired;
        available = issued - retired;
    }

    // -------------------------------------------------------------------------
    // Pause control
    // -------------------------------------------------------------------------

    function paused() external view returns (bool) {
        return _paused;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        if (_paused) revert EnforcedPause();
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        if (!_paused) revert ExpectedPause();
        _paused = false;
        emit Unpaused(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _checkRole(bytes32 role, address account) internal view {
        if (!hasRole(role, account)) revert AccessControlUnauthorizedAccount(account, role);
    }

    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
        bytes32 previousAdminRole = _roleAdmins[role];
        _roleAdmins[role] = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    function _grantRole(bytes32 role, address account) internal {
        if (account == address(0)) revert ZeroAddress();
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    function _revokeRole(bytes32 role, address account) internal {
        if (_roles[role][account]) {
            _roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    function _registerEvidence(bytes32 evidenceId, string memory uri, bytes32 contentHash) internal {
        if (evidenceId == bytes32(0)) revert InvalidIdentifier();
        if (evidenceExists[evidenceId]) revert AlreadyExists(evidenceId);

        evidenceExists[evidenceId] = true;
        _evidence[evidenceId] = EvidenceRecord({
            uri: uri,
            contentHash: contentHash,
            registeredBy: msg.sender,
            registeredAt: block.timestamp
        });

        emit EvidenceRegistered(evidenceId, contentHash, uri, msg.sender);
    }

    function _validateOperation(bytes32 operationId) internal view {
        if (operationId == bytes32(0)) revert InvalidIdentifier();
        if (operationUsed[operationId]) revert DuplicateOperationId(operationId);
    }

    function _validateProject(bytes32 projectId) internal pure {
        if (projectId == bytes32(0)) revert InvalidIdentifier();
    }

    function _validateQuantity(uint256 quantity) internal pure {
        if (quantity == 0) revert InvalidQuantity();
    }
}
