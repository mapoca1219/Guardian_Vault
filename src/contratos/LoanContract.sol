// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title LoanContract
 * @dev Gestiona el pool de liquidez de PYUSD para los préstamos de emergencia.
 * Este contrato NO tiene propietario, es un pool autónomo.
 * Su única autoridad es el VaultContract.
 */
contract LoanContract is ReentrancyGuard {

    // --- Almacenamiento ---

    IERC20 public immutable pyusdToken;
    address public immutable vaultContract; // La única autoridad que puede activar préstamos

    uint256 public constant EMERGENCY_LOAN_AMOUNT = 200 * 10**18; // 200 PYUSD (asumiendo 18 decimales)

    // Mapeo del propietario del Vault => ¿Préstamo de emergencia disponible?
    mapping(address => bool) public activeRecoveries;
    // Mapeo del propietario del Vault => ¿Ya retiró el préstamo?
    mapping(address => bool) public loanWithdrawn;

    // --- Eventos ---
    event EmergencyLoanActivated(address indexed user);
    event EmergencyLoanWithdrawn(address indexed user, uint256 amount);
    event PoolFunded(address indexed funder, uint256 amount);

    // --- Constructor ---

    constructor(address _pyusdToken, address _vaultContract) {
        require(_pyusdToken != address(0), "PYUSD address cannot be zero");
        require(_vaultContract != address(0), "Vault contract address cannot be zero");
        pyusdToken = IERC20(_pyusdToken);
        vaultContract = _vaultContract;
    }

    // --- Funciones de Liquidez ---

    /**
     * @dev Permite a cualquiera (o a un pool de liquidez como Aave) financiar el contrato.
     * El financiador debe haber aprobado a este contrato para gastar su PYUSD.
     */
    function fundPool(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");
        // Transfiere PYUSD desde el financiador a este contrato
        bool success = pyusdToken.transferFrom(_msgSender(), address(this), _amount);
        require(success, "PYUSD transfer failed");
        emit PoolFunded(_msgSender(), _amount);
    }

    // --- Funciones de Préstamo ---

    /**
     * @dev ¡FUNCIÓN CRÍTICA! Solo puede ser llamada por el VaultContract.
     * Marca a un usuario (el propietario del Vault) como elegible para el préstamo de emergencia.
     * @param _user La dirección del *propietario actual* del Vault que está en recuperación.
     */
    function activateEmergencyLoan(address _user) external {
        require(_msgSender() == vaultContract, "Only the VaultContract can call this");
        require(_user != address(0), "Invalid user");
        
        activeRecoveries[_user] = true;
        
        emit EmergencyLoanActivated(_user);
    }

    /**
     * @dev Permite al usuario (propietario del Vault) retirar su préstamo de emergencia.
     * Esta es la transacción que el usuario firma desde el frontend (Angular).
     */
    function withdrawEmergencyLoan() external nonReentrant {
        require(activeRecoveries[_msgSender()], "Emergency loan not active");
        require(!loanWithdrawn[_msgSender()], "Loan already withdrawn");

        // Marca como retirado ANTES de transferir (previene reentrada)
        loanWithdrawn[_msgSender()] = true;
        
        uint256 balance = pyusdToken.balanceOf(address(this));
        require(balance >= EMERGENCY_LOAN_AMOUNT, "Insufficient liquidity in pool");

        // Transfiere los 200 PYUSD al usuario
        bool success = pyusdToken.transfer(_msgSender(), EMERGENCY_LOAN_AMOUNT);
        require(success, "PYUSD transfer failed");
        
        emit EmergencyLoanWithdrawn(_msgSender(), EMERGENCY_LOAN_AMOUNT);
    }

    // (Aquí iría la lógica para el "Crédito Social", 
    // que probablemente implicaría co-firmas de guardianes para un préstamo mayor).
}
