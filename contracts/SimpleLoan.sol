// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Simple {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SimpleLoan {
    IERC20Simple public pyusdToken;
    address public vaultContract;
    uint256 public constant EMERGENCY_LOAN_AMOUNT = 200 * 10**18;
    
    mapping(address => bool) public activeRecoveries;
    mapping(address => bool) public loanWithdrawn;
    
    event EmergencyLoanActivated(address indexed user);
    event EmergencyLoanWithdrawn(address indexed user, uint256 amount);
    event PoolFunded(address indexed funder, uint256 amount);
    
    constructor(address _pyusdToken, address _vaultContract) {
        pyusdToken = IERC20Simple(_pyusdToken);
        vaultContract = _vaultContract;
    }
    
    function fundPool(uint256 _amount) external {
        require(pyusdToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        emit PoolFunded(msg.sender, _amount);
    }
    
    function activateEmergencyLoan(address _user) external {
        require(msg.sender == vaultContract, "Only vault");
        activeRecoveries[_user] = true;
        emit EmergencyLoanActivated(_user);
    }
    
    function withdrawEmergencyLoan() external {
        require(activeRecoveries[msg.sender], "Not active");
        require(!loanWithdrawn[msg.sender], "Already withdrawn");
        
        loanWithdrawn[msg.sender] = true;
        
        require(pyusdToken.balanceOf(address(this)) >= EMERGENCY_LOAN_AMOUNT, "Insufficient funds");
        require(pyusdToken.transfer(msg.sender, EMERGENCY_LOAN_AMOUNT), "Transfer failed");
        
        emit EmergencyLoanWithdrawn(msg.sender, EMERGENCY_LOAN_AMOUNT);
    }
}