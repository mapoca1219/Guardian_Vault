const hre = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("💰 Financiando cuentas para demo...");

  // Leer direcciones desplegadas
  const addresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
  
  // Obtener contratos
  const MockPYUSD = await hre.ethers.getContractFactory("MockPYUSD");
  const pyusd = MockPYUSD.attach(addresses.pyusd);
  
  // Obtener signers
  const [deployer] = await hre.ethers.getSigners();
  
  // Cantidad para demo
  const demoAmount = hre.ethers.parseUnits("500", 18); // 500 PYUSD
  
  console.log("Enviando", hre.ethers.formatUnits(demoAmount, 18), "PYUSD a:", deployer.address);
  
  await pyusd.faucet(deployer.address, demoAmount);
  
  const balance = await pyusd.balanceOf(deployer.address);
  console.log("✅ Balance actual:", hre.ethers.formatUnits(balance, 18), "PYUSD");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });