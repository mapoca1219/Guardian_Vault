#!/bin/bash

echo "🚀 Iniciando entorno de demo para la hackathon..."

cleanup() {
    echo "🧹 Limpiando procesos..."
    kill $HARDHAT_PID 2>/dev/null
    kill $ANGULAR_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# 1. Iniciar nodo local de Hardhat
echo "📡 Iniciando nodo local de Hardhat..."
npx hardhat node &
HARDHAT_PID=$!

sleep 5

# 2. Desplegar contratos
echo "📄 Desplegando contratos..."
npx hardhat run scripts/deploy-simple.js --network localhost

# 3. Deshabilitar analytics de Angular
ng analytics disable

# 4. Iniciar servidor Angular
echo "🌐 Iniciando servidor Angular..."
ng serve &
ANGULAR_PID=$!

echo ""
echo "✅ Entorno de demo iniciado!"
echo "📋 Información importante:"
echo "   🌐 Frontend: http://localhost:4200"
echo "   📡 Blockchain local: http://127.0.0.1:8545"
echo "   🔑 Cuenta principal: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo ""
echo "🎯 Para conectar MetaMask:"
echo "   1. Agregar red personalizada"
echo "   2. RPC URL: http://127.0.0.1:8545"
echo "   3. Chain ID: 31337"
echo "   4. Símbolo: ETH"
echo ""
echo "💡 Presiona Ctrl+C para detener todo"

wait