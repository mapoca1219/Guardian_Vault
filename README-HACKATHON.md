# Guardian Vault - Demo para Hackathon Web3 🏆

## 🚀 Inicio Rápido

### Opción 1: Script Automático (Recomendado)
```bash
./start-demo.sh
```

### Opción 2: Manual
```bash
# Terminal 1: Iniciar blockchain local
npx hardhat node

# Terminal 2: Desplegar contratos
npx hardhat run scripts/deploy-simple.js --network localhost

# Terminal 3: Iniciar frontend
npm start
```

## 📋 Información del Demo

### 🔗 Direcciones de Contratos Desplegados
- **SimplePYUSD**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **SimpleVault**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- **SimpleLoan**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`

### 👥 Cuentas de Prueba
- **Deployer**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Guardian 1**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- **Guardian 2**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

### 🔧 Configuración de MetaMask
1. **Agregar Red Personalizada**:
   - Nombre: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Símbolo: `ETH`

2. **Importar Cuenta de Prueba**:
   - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

## 🎯 Funcionalidades del Demo

### ✅ Implementado y Funcional
- 🔐 **Recuperación Social**: Sistema de guardianes para recuperar cuentas
- 💰 **Préstamos de Emergencia**: 200 PYUSD disponibles durante recuperación
- 🏦 **Token PYUSD**: Token de prueba completamente funcional
- 📊 **Dashboard**: Interfaz completa con balances reales
- 🔄 **Transacciones**: Sistema de pagos y transferencias

### 🚧 Simulado (Para Demo)
- 📈 **Reportes Fiscales**: Datos de ejemplo
- 🤖 **IA de Seguridad**: Respuestas simuladas
- 📱 **Notificaciones**: Sistema básico

## 🎮 Flujo de Demo para Jueces

### 1. Configuración Inicial (2 min)
```bash
./start-demo.sh
```
- Abrir http://localhost:4200
- Conectar MetaMask con la cuenta de prueba

### 2. Demostrar Funcionalidades (5 min)
1. **Ver Dashboard**: Balances reales de ETH y PYUSD
2. **Realizar Pago**: Usar función "Realizar Pago/Operación"
3. **Iniciar Recuperación**: Simular pérdida de cuenta
4. **Aprobar Recuperación**: Como guardián
5. **Usar Préstamo de Emergencia**: Durante timelock

### 3. Mostrar Código (3 min)
- Contratos en `/contracts/`
- Frontend en `/src/app/app.ts`
- Arquitectura descentralizada

## 🏗️ Arquitectura Técnica

### Smart Contracts
- **SimpleVault**: Gestión de propiedad y recuperación social
- **SimpleLoan**: Pool de liquidez para préstamos de emergencia
- **SimplePYUSD**: Token ERC20 para pagos

### Frontend
- **Angular 20**: Framework moderno
- **Ethers.js**: Interacción con blockchain
- **TailwindCSS**: Diseño responsive

### Blockchain
- **Hardhat**: Entorno de desarrollo local
- **Solidity 0.8.20**: Contratos inteligentes

## 💡 Puntos Clave para Jueces

### 🎯 Problema Resuelto
- **Auto-custodia segura** sin puntos únicos de falla
- **Recuperación social** sin depender de exchanges
- **Liquidez inmediata** durante emergencias

### 🚀 Innovación
- **Sin custodios centralizados**: Todo en blockchain
- **Recuperación gradual**: Timelock de seguridad
- **Préstamos automáticos**: Activados por consenso social

### 🔒 Seguridad
- **Contratos auditables**: Código abierto y simple
- **Múltiples firmas**: Requiere consenso de guardianes
- **Timelock**: Protección contra ataques

## 🛠️ Comandos Útiles

```bash
# Obtener más tokens PYUSD
npx hardhat run scripts/fund-accounts.js --network localhost

# Ver logs de la blockchain
# (Los logs aparecen en la terminal donde corre `npx hardhat node`)

# Reiniciar todo
# Ctrl+C en el script y volver a ejecutar ./start-demo.sh
```

## 🏆 ¿Por qué deberíamos ganar?

1. **Funcionalidad Real**: No es solo un mockup, los contratos funcionan
2. **Problema Real**: Auto-custodia es el futuro de Web3
3. **Solución Elegante**: Combina seguridad social con liquidez DeFi
4. **Código Limpio**: Arquitectura simple y auditable
5. **Demo Completo**: Experiencia end-to-end funcional

---

**¡Buena suerte en la hackathon! 🚀**