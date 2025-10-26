#!/bin/bash

echo "🚀 Iniciando demo con PYUSD REAL..."

cleanup() {
    echo "🧹 Limpiando procesos..."
    kill $HARDHAT_PID 2>/dev/null
    kill $ANGULAR_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# 1. Iniciar nodo con fork de mainnet
echo "📡 Iniciando fork de Ethereum mainnet..."
npx hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/demo &
HARDHAT_PID=$!

sleep 8

# 2. Desplegar contratos con PYUSD real
echo "📄 Desplegando contratos con PYUSD real..."
npx hardhat run scripts/deploy-with-real-pyusd.js --network localhost

# 3. Iniciar Angular
echo "🌐 Iniciando frontend..."
npm start &
ANGULAR_PID=$!

echo ""
echo "✅ Demo con PYUSD REAL iniciado!"
echo "📋 Información:"
echo "   🌐 Frontend: http://localhost:4200"
echo "   📡 Fork de mainnet: http://127.0.0.1:8545"
echo "   💰 PYUSD Real: 0x6c3ea9036406852006290770BEdFcAbA0e23A0e8"
echo ""
echo "🎯 MetaMask:"
echo "   RPC: http://127.0.0.1:8545"
echo "   Chain ID: 31337"
echo ""
echo "💡 Presiona Ctrl+C para detener"

wait