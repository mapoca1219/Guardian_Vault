const hre = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("🎁 Obteniendo tokens PYUSD para demo...");

  // Leer direcciones
  let addresses;
  try {
    addresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
  } catch (error) {
    console.error("❌ No se encontró deployed-addresses.json. ¿Desplegaste los contratos?");
    process.exit(1);
  }
  
  // Obtener contrato
  const SimplePYUSD = await hre.ethers.getContractFactory("SimplePYUSD");
  const pyusd = SimplePYUSD.attach(addresses.pyusd);
  
  // Obtener signer
  const [deployer] = await hre.ethers.getSigners();
  
  // Cantidad para demo
  const amount = hre.ethers.parseUnits("500", 18); // 500 PYUSD
  
  console.log("📤 Enviando", hre.ethers.formatUnits(amount, 18), "PYUSD a:", deployer.address);
  
  await pyusd.faucet(deployer.address, amount);
  
  const balance = await pyusd.balanceOf(deployer.address);
  console.log("✅ Balance actual:", hre.ethers.formatUnits(balance, 18), "PYUSD");
  console.log("🎯 ¡Listo para continuar el demo!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });