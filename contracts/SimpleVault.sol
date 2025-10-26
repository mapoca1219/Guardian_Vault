// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISimpleLoan {
    function activateEmergencyLoan(address user) external;
}

contract SimpleVault {
    address public owner;
    address public loanContract;
    uint256 public constant REQUIRED_APPROVALS = 2;
    
    mapping(address => bool) public isGuardian;
    uint256 public guardianCount;
    
    struct Recovery {
        bool active;
        address newOwner;
        uint256 approvalCount;
        mapping(address => bool) approvals;
    }
    
    Recovery public activeRecovery;
    
    event RecoveryStarted(address newOwner, address indexed guardian);
    event RecoveryApproved(address indexed guardian);
    event RecoveryExecuted(address oldOwner, address indexed newOwner);
    event GuardianAdded(address indexed guardian);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _owner, address[] memory _guardians, address _loanContract) {
        owner = _owner;
        loanContract = _loanContract;
        
        for (uint256 i = 0; i < _guardians.length; i++) {
            isGuardian[_guardians[i]] = true;
            emit GuardianAdded(_guardians[i]);
        }
        guardianCount = _guardians.length;
    }
    
    function addGuardian(address _guardian) external onlyOwner {
        require(!isGuardian[_guardian], "Already guardian");
        isGuardian[_guardian] = true;
        guardianCount++;
        emit GuardianAdded(_guardian);
    }
    
    function startRecovery(address _newOwner) external {
        require(isGuardian[msg.sender], "Not guardian");
        require(!activeRecovery.active, "Recovery active");
        
        activeRecovery.active = true;
        activeRecovery.newOwner = _newOwner;
        activeRecovery.approvalCount = 1;
        activeRecovery.approvals[msg.sender] = true;
        
        emit RecoveryStarted(_newOwner, msg.sender);
    }
    
    function approveRecovery() external {
        require(isGuardian[msg.sender], "Not guardian");
        require(activeRecovery.active, "No recovery");
        require(!activeRecovery.approvals[msg.sender], "Already approved");
        
        activeRecovery.approvals[msg.sender] = true;
        activeRecovery.approvalCount++;
        
        emit RecoveryApproved(msg.sender);
        
        if (activeRecovery.approvalCount >= REQUIRED_APPROVALS) {
            try ISimpleLoan(loanContract).activateEmergencyLoan(owner) {} catch {}
        }
    }
    
    function executeRecovery() external {
        require(activeRecovery.active, "No recovery");
        require(activeRecovery.approvalCount >= REQUIRED_APPROVALS, "Not enough approvals");
        
        address oldOwner = owner;
        owner = activeRecovery.newOwner;
        
        delete activeRecovery;
        
        emit RecoveryExecuted(oldOwner, owner);
    }
    
    receive() external payable {}
}