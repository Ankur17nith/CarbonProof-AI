// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CarbonCreditRegistry} from "../src/CarbonCreditRegistry.sol";

interface Vm {
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool condition) internal pure {
        require(condition, "assertTrue failed");
    }

    function assertFalse(bool condition) internal pure {
        require(!condition, "assertFalse failed");
    }

    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "uint256 values differ");
    }

    function assertEq(bytes32 left, bytes32 right) internal pure {
        require(left == right, "bytes32 values differ");
    }

    function assertEq(address left, address right) internal pure {
        require(left == right, "address values differ");
    }
}

contract CarbonCreditRegistryTest is TestBase {
    CarbonCreditRegistry internal registry;

    address internal constant ADMIN = address(0xA11CE);
    address internal constant EVIDENCE_OPERATOR = address(0xE11D0CE);
    address internal constant ISSUER = address(0x1555E2);
    address internal constant RETIREE = address(0xBEEF03);
    address internal constant UNAUTHORIZED = address(0xBAD);

    bytes32 internal constant EVIDENCE_ONE = keccak256("evidence-one");
    bytes32 internal constant EVIDENCE_TWO = keccak256("evidence-two");
    bytes32 internal constant PROJECT_ONE = keccak256("project-one");
    bytes32 internal constant PROJECT_TWO = keccak256("project-two");
    bytes32 internal constant ISSUE_OPERATION = keccak256("issue-operation");
    bytes32 internal constant SECOND_ISSUE_OPERATION = keccak256("second-issue-operation");
    bytes32 internal constant RETIRE_OPERATION = keccak256("retire-operation");

    function setUp() public {
        registry = new CarbonCreditRegistry(ADMIN);
    }

    function testDeploymentGrantsAdminAndOperationalRoles() public {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), ADMIN));
        assertTrue(registry.hasRole(registry.EVIDENCE_ROLE(), ADMIN));
        assertTrue(registry.hasRole(registry.MINTER_ROLE(), ADMIN));
        assertTrue(registry.hasRole(registry.RETIRER_ROLE(), ADMIN));
        assertTrue(registry.hasRole(registry.PAUSER_ROLE(), ADMIN));

        assertEq(registry.getRoleAdmin(registry.EVIDENCE_ROLE()), registry.DEFAULT_ADMIN_ROLE());
        assertEq(registry.getRoleAdmin(registry.MINTER_ROLE()), registry.DEFAULT_ADMIN_ROLE());
        assertEq(registry.getRoleAdmin(registry.RETIRER_ROLE()), registry.DEFAULT_ADMIN_ROLE());
        assertEq(registry.getRoleAdmin(registry.PAUSER_ROLE()), registry.DEFAULT_ADMIN_ROLE());
        assertFalse(registry.paused());
    }

    function testDeploymentRejectsZeroAdmin() public {
        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.ZeroAddress.selector));
        new CarbonCreditRegistry(address(0));
    }

    function testRoleGrantAndRevocation() public {
        vm.prank(ADMIN);
        registry.grantRole(registry.EVIDENCE_ROLE(), EVIDENCE_OPERATOR);
        assertTrue(registry.hasRole(registry.EVIDENCE_ROLE(), EVIDENCE_OPERATOR));

        vm.prank(ADMIN);
        registry.revokeRole(registry.EVIDENCE_ROLE(), EVIDENCE_OPERATOR);
        assertFalse(registry.hasRole(registry.EVIDENCE_ROLE(), EVIDENCE_OPERATOR));
    }

    function testNonAdminCannotGrantRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                CarbonCreditRegistry.AccessControlUnauthorizedAccount.selector,
                UNAUTHORIZED,
                registry.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(UNAUTHORIZED);
        registry.grantRole(registry.MINTER_ROLE(), UNAUTHORIZED);
    }

    function testEvidenceRegistrationStoresRecord() public {
        _registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));

        assertTrue(registry.evidenceExists(EVIDENCE_ONE));
        (bytes32 contentHash, address registeredBy, uint256 registeredAt) = _readEvidence(EVIDENCE_ONE);
        assertEq(contentHash, keccak256("content-one"));
        assertEq(registeredBy, ADMIN);
        assertTrue(registeredAt > 0);
    }

    function testDuplicateEvidenceIsRejected() public {
        _registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.AlreadyExists.selector, EVIDENCE_ONE));
        vm.prank(ADMIN);
        registry.registerEvidence(EVIDENCE_ONE, "ipfs://replacement", keccak256("replacement"));
    }

    function testBatchEvidenceRegistrationStoresAllRecords() public {
        bytes32[] memory evidenceIds = new bytes32[](2);
        evidenceIds[0] = EVIDENCE_ONE;
        evidenceIds[1] = EVIDENCE_TWO;
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://evidence-one";
        uris[1] = "ipfs://evidence-two";
        bytes32[] memory contentHashes = new bytes32[](2);
        contentHashes[0] = keccak256("content-one");
        contentHashes[1] = keccak256("content-two");

        vm.prank(ADMIN);
        registry.registerEvidenceBatch(evidenceIds, uris, contentHashes);

        assertTrue(registry.evidenceExists(EVIDENCE_ONE));
        assertTrue(registry.evidenceExists(EVIDENCE_TWO));
        (bytes32 contentHash, address registeredBy, uint256 registeredAt) = _readEvidence(EVIDENCE_TWO);
        assertEq(contentHash, keccak256("content-two"));
        assertEq(registeredBy, ADMIN);
        assertTrue(registeredAt > 0);
    }

    function testBatchEvidenceRegistrationRejectsMismatchedArrays() public {
        bytes32[] memory evidenceIds = new bytes32[](1);
        evidenceIds[0] = EVIDENCE_ONE;
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://evidence-one";
        uris[1] = "ipfs://evidence-two";
        bytes32[] memory contentHashes = new bytes32[](1);
        contentHashes[0] = keccak256("content-one");

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.ArrayLengthMismatch.selector));
        vm.prank(ADMIN);
        registry.registerEvidenceBatch(evidenceIds, uris, contentHashes);
    }

    function testBatchEvidenceRegistrationRejectsDuplicateAndRollsBack() public {
        _registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));

        bytes32[] memory evidenceIds = new bytes32[](2);
        evidenceIds[0] = EVIDENCE_TWO;
        evidenceIds[1] = EVIDENCE_ONE;
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://evidence-two";
        uris[1] = "ipfs://replacement";
        bytes32[] memory contentHashes = new bytes32[](2);
        contentHashes[0] = keccak256("content-two");
        contentHashes[1] = keccak256("replacement");

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.AlreadyExists.selector, EVIDENCE_ONE));
        vm.prank(ADMIN);
        registry.registerEvidenceBatch(evidenceIds, uris, contentHashes);

        assertFalse(registry.evidenceExists(EVIDENCE_TWO));
    }

    function testRevokedEvidenceRoleCannotRegister() public {
        vm.prank(ADMIN);
        registry.grantRole(registry.EVIDENCE_ROLE(), EVIDENCE_OPERATOR);
        vm.prank(ADMIN);
        registry.revokeRole(registry.EVIDENCE_ROLE(), EVIDENCE_OPERATOR);

        vm.expectRevert(
            abi.encodeWithSelector(
                CarbonCreditRegistry.AccessControlUnauthorizedAccount.selector,
                EVIDENCE_OPERATOR,
                registry.EVIDENCE_ROLE()
            )
        );
        vm.prank(EVIDENCE_OPERATOR);
        registry.registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));
    }

    function testIssuerCanIssueOnlyAgainstRegisteredEvidence() public {
        _registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.UnknownEvidence.selector, EVIDENCE_TWO));
        vm.prank(ADMIN);
        registry.issueCredits(ISSUE_OPERATION, PROJECT_ONE, 100, EVIDENCE_TWO);

        vm.prank(ADMIN);
        registry.issueCredits(ISSUE_OPERATION, PROJECT_ONE, 100, EVIDENCE_ONE);

        (uint256 issued, uint256 retired, uint256 available) = registry.getCreditBalance(PROJECT_ONE);
        assertEq(issued, 100);
        assertEq(retired, 0);
        assertEq(available, 100);
        assertTrue(registry.operationUsed(ISSUE_OPERATION));
    }

    function testRevokedMinterRoleCannotIssue() public {
        _registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));
        vm.prank(ADMIN);
        registry.grantRole(registry.MINTER_ROLE(), ISSUER);
        vm.prank(ADMIN);
        registry.revokeRole(registry.MINTER_ROLE(), ISSUER);

        vm.expectRevert(
            abi.encodeWithSelector(
                CarbonCreditRegistry.AccessControlUnauthorizedAccount.selector,
                ISSUER,
                registry.MINTER_ROLE()
            )
        );
        vm.prank(ISSUER);
        registry.issueCredits(ISSUE_OPERATION, PROJECT_ONE, 100, EVIDENCE_ONE);
    }

    function testIssuanceRejectsZeroQuantity() public {
        _registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.InvalidQuantity.selector));
        vm.prank(ADMIN);
        registry.issueCredits(ISSUE_OPERATION, PROJECT_ONE, 0, EVIDENCE_ONE);
    }

    function testRetirementReducesAvailableCredits() public {
        _issueCredits(100);

        vm.prank(ADMIN);
        registry.retireCredits(RETIRE_OPERATION, PROJECT_ONE, 40);

        (uint256 issued, uint256 retired, uint256 available) = registry.getCreditBalance(PROJECT_ONE);
        assertEq(issued, 100);
        assertEq(retired, 40);
        assertEq(available, 60);
        assertTrue(registry.operationUsed(RETIRE_OPERATION));
    }

    function testRetirementRejectsZeroAndExcessQuantity() public {
        _issueCredits(100);

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.InvalidQuantity.selector));
        vm.prank(ADMIN);
        registry.retireCredits(RETIRE_OPERATION, PROJECT_ONE, 0);

        vm.expectRevert(
            abi.encodeWithSelector(CarbonCreditRegistry.InsufficientCredits.selector, PROJECT_ONE, 101, 100)
        );
        vm.prank(ADMIN);
        registry.retireCredits(RETIRE_OPERATION, PROJECT_ONE, 101);
    }

    function testOperationIdsAreUniqueAcrossIssuanceAndRetirement() public {
        _issueCredits(100);

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.DuplicateOperationId.selector, ISSUE_OPERATION));
        vm.prank(ADMIN);
        registry.issueCredits(ISSUE_OPERATION, PROJECT_TWO, 50, EVIDENCE_ONE);

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.DuplicateOperationId.selector, ISSUE_OPERATION));
        vm.prank(ADMIN);
        registry.retireCredits(ISSUE_OPERATION, PROJECT_ONE, 10);

        vm.prank(ADMIN);
        registry.retireCredits(RETIRE_OPERATION, PROJECT_ONE, 10);

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.DuplicateOperationId.selector, RETIRE_OPERATION));
        vm.prank(ADMIN);
        registry.retireCredits(RETIRE_OPERATION, PROJECT_ONE, 10);
    }

    function testPauseBlocksEvidenceIssuanceAndRetirement() public {
        _issueCredits(100);

        vm.prank(ADMIN);
        registry.pause();
        assertTrue(registry.paused());

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.EnforcedPause.selector));
        vm.prank(ADMIN);
        registry.registerEvidence(EVIDENCE_TWO, "ipfs://evidence-two", keccak256("content-two"));

        bytes32[] memory evidenceIds = new bytes32[](1);
        evidenceIds[0] = EVIDENCE_TWO;
        string[] memory uris = new string[](1);
        uris[0] = "ipfs://evidence-two";
        bytes32[] memory contentHashes = new bytes32[](1);
        contentHashes[0] = keccak256("content-two");
        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.EnforcedPause.selector));
        vm.prank(ADMIN);
        registry.registerEvidenceBatch(evidenceIds, uris, contentHashes);

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.EnforcedPause.selector));
        vm.prank(ADMIN);
        registry.issueCredits(SECOND_ISSUE_OPERATION, PROJECT_ONE, 1, EVIDENCE_ONE);

        vm.expectRevert(abi.encodeWithSelector(CarbonCreditRegistry.EnforcedPause.selector));
        vm.prank(ADMIN);
        registry.retireCredits(RETIRE_OPERATION, PROJECT_ONE, 1);

        vm.prank(ADMIN);
        registry.unpause();
        assertFalse(registry.paused());

        vm.prank(ADMIN);
        registry.registerEvidence(EVIDENCE_TWO, "ipfs://evidence-two", keccak256("content-two"));
    }

    function testRevokedPauserCannotPause() public {
        vm.prank(ADMIN);
        registry.grantRole(registry.PAUSER_ROLE(), RETIREE);
        vm.prank(ADMIN);
        registry.revokeRole(registry.PAUSER_ROLE(), RETIREE);

        vm.expectRevert(
            abi.encodeWithSelector(
                CarbonCreditRegistry.AccessControlUnauthorizedAccount.selector,
                RETIREE,
                registry.PAUSER_ROLE()
            )
        );
        vm.prank(RETIREE);
        registry.pause();
    }

    function testRoleHolderCanRenounceRole() public {
        vm.prank(ADMIN);
        registry.grantRole(registry.MINTER_ROLE(), ISSUER);

        vm.prank(ISSUER);
        registry.renounceRole(registry.MINTER_ROLE(), ISSUER);
        assertFalse(registry.hasRole(registry.MINTER_ROLE(), ISSUER));

        vm.expectRevert(
            abi.encodeWithSelector(
                CarbonCreditRegistry.AccessControlBadConfirmation.selector
            )
        );
        vm.prank(ISSUER);
        registry.renounceRole(registry.MINTER_ROLE(), ADMIN);
    }

    function _registerEvidence(bytes32 evidenceId, string memory uri, bytes32 contentHash) internal {
        vm.prank(ADMIN);
        registry.registerEvidence(evidenceId, uri, contentHash);
    }

    function _readEvidence(bytes32 evidenceId)
        internal
        view
        returns (bytes32 contentHash, address registeredBy, uint256 registeredAt)
    {
        string memory uri;
        (uri, contentHash, registeredBy, registeredAt) = registry.getEvidence(evidenceId);
    }

    function _issueCredits(uint256 quantity) internal {
        _registerEvidence(EVIDENCE_ONE, "ipfs://evidence-one", keccak256("content-one"));
        vm.prank(ADMIN);
        registry.issueCredits(ISSUE_OPERATION, PROJECT_ONE, quantity, EVIDENCE_ONE);
    }
}
