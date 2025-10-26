// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Interfaz para que este contrato sepa cómo hablar con el LoanContract
interface ILoanContract {
    function activateEmergencyLoan(address user) external;
}

/**
 * @title VaultContract
 * @dev Gestiona la propiedad de los fondos y la lógica de recuperación social.
 * Este contrato es el "dueño" principal de los activos del usuario.
 * Inspirado en el diseño de Argent y Safe.
 */
contract VaultContract is Ownable, ReentrancyGuard {
    
    // --- Almacenamiento ---

    address public immutable loanContract; // El contrato de préstamos
    uint256 public constant TIMELOCK_DURATION = 48 hours;
    uint256 public constant REQUIRED_APPROVALS = 2; // Ejemplo: 2 guardianes necesarios

    mapping(address => bool) public isGuardian;
    uint256 public guardianCount;

    // --- Estructura de Recuperación ---
    struct Recovery {
        bool active;
        address newOwner;
        uint256 approvalCount;
        uint256 recoveryTimestamp; // Marca de tiempo cuando se puede ejecutar
        mapping(address => bool) approvals;
    }

    Recovery public activeRecovery;

    // --- Eventos ---
    event RecoveryStarted(address newOwner, address indexed guardian);
    event RecoveryApproved(address indexed guardian);
    event RecoveryExecuted(address oldOwner, address indexed newOwner);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);

    // --- Constructor ---

    /**
     * @dev Configura el Vault.
     * @param _initialOwner La dirección del propietario inicial.
     * @param _guardians Una lista inicial de guardianes para la recuperación.
     * @param _loanContract La dirección del LoanContract para la liquidez de emergencia.
     */
    constructor(address _initialOwner, address[] memory _guardians, address _loanContract) Ownable(_initialOwner) {
        require(_loanContract != address(0), "Loan contract address cannot be zero");
        loanContract = _loanContract;

        for (uint256 i = 0; i < _guardians.length; i++) {
            require(_guardians[i] != address(0), "Invalid guardian");
            isGuardian[_guardians[i]] = true;
            emit GuardianAdded(_guardians[i]);
        }
        guardianCount = _guardians.length;
        require(guardianCount >= REQUIRED_APPROVALS, "Not enough guardians");
    }

    // --- Funciones de Gestión de Guardianes (Solo Propietario) ---

    function addGuardian(address _guardian) external onlyOwner {
        require(_guardian != address(0), "Invalid address");
        require(!isGuardian[_guardian], "Already a guardian");
        isGuardian[_guardian] = true;
        guardianCount++;
        emit GuardianAdded(_guardian);
    }

    function removeGuardian(address _guardian) external onlyOwner {
        require(isGuardian[_guardian], "Not a guardian");
        require(guardianCount - 1 >= REQUIRED_APPROVALS, "Not enough guardians left");
        isGuardian[_guardian] = false;
        guardianCount--;
        emit GuardianRemoved(_guardian);
    }

    // --- Funciones de Recuperación (Abiertas a Guardianes) ---

    /**
     * @dev Inicia el proceso de recuperación. Llamado por un guardián.
     * @param _newOwner La nueva dirección que el guardián propone como propietario.
     */
    function startRecovery(address _newOwner) external {
        require(isGuardian[_msgSender()], "Only a guardian can start recovery");
        require(!activeRecovery.active, "Recovery already in progress");
        require(_newOwner != address(0), "Invalid new owner");

        activeRecovery.active = true;
        activeRecovery.newOwner = _newOwner;
        activeRecovery.approvalCount = 1;
        activeRecovery.approvals[_msgSender()] = true;
        
        emit RecoveryStarted(_newOwner, _msgSender());
    }

    /**
     * @dev Aprueba una recuperación en curso. Llamado por otros guardianes.
     */
    function approveRecovery() external {
        require(isGuardian[_msgSender()], "Only a guardian can approve");
        require(activeRecovery.active, "No recovery in progress");
        require(!activeRecovery.approvals[_msgSender()], "Already approved");

        activeRecovery.approvals[_msgSender()] = true;
        activeRecovery.approvalCount++;
        
        emit RecoveryApproved(_msgSender());

        // ¡FLUJO CRÍTICO!
        // Si se alcanza el umbral, activa el préstamo de emergencia y el time-lock.
        if (activeRecovery.approvalCount == REQUIRED_APPROVALS) {
            activeRecovery.recoveryTimestamp = block.timestamp + TIMELOCK_DURATION;
            
            // Llama al LoanContract para desbloquear el PYUSD
            try ILoanContract(loanContract).activateEmergencyLoan(owner()) {}
            catch {
                // Manejar el error si la llamada falla, quizás revertir o emitir un evento
            }
        }
    }

    /**
     * @dev Ejecuta la recuperación DESPUÉS del time-lock.
     * Esto puede ser llamado por cualquiera (generalmente el nuevo propietario).
     */
    function executeRecovery() external nonReentrant {
        require(activeRecovery.active, "No recovery in progress");
        require(activeRecovery.approvalCount >= REQUIRED_APPROVALS, "Not enough approvals");
        require(block.timestamp >= activeRecovery.recoveryTimestamp, "Time-lock active");

        address oldOwner = owner();
        address newOwner = activeRecovery.newOwner;

        // Limpia el estado de recuperación
        delete activeRecovery;
        
        // Transfiere la propiedad del Vault
        _transferOwnership(newOwner);
        
        emit RecoveryExecuted(oldOwner, newOwner);
    }

    // --- Funciones de Utilidad ---

    // Este contrato recibirá los fondos principales del usuario (ETH, etc.)
    receive() external payable {}

    // (Aquí iría la lógica para que el propietario interactúe con otros 
    // protocolos DeFi, por ejemplo, llamando a otros contratos).
}
