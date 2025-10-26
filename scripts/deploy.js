const hre = require("hardhat");

async function main() {
  console.log("🚀 Desplegando contratos para la hackathon...");

  // Obtener signers
  const [deployer, guardian1, guardian2] = await hre.ethers.getSigners();
  
  console.log("Deployer:", deployer.address);
  console.log("Guardian 1:", guardian1.address);
  console.log("Guardian 2:", guardian2.address);

  // 1. Desplegar MockPYUSD
  console.log("\n📄 Desplegando MockPYUSD...");
  const MockPYUSD = await hre.ethers.getContractFactory("MockPYUSD");
  const pyusd = await MockPYUSD.deploy();
  await pyusd.waitForDeployment();
  const pyusdAddress = await pyusd.getAddress();
  console.log("✅ MockPYUSD desplegado en:", pyusdAddress);

  // 2. Desplegar LoanContract
  console.log("\n🏦 Desplegando LoanContract...");
  const LoanContract = await hre.ethers.getContractFactory("LoanContract");
  // Usamos address(0) temporalmente para vaultContract, lo actualizaremos después
  const loanContract = await LoanContract.deploy(pyusdAddress, "0x0000000000000000000000000000000000000000");
  await loanContract.waitForDeployment();
  const loanAddress = await loanContract.getAddress();
  console.log("✅ LoanContract desplegado en:", loanAddress);

  // 3. Desplegar VaultContract
  console.log("\n🔐 Desplegando VaultContract...");
  const VaultContract = await hre.ethers.getContractFactory("VaultContract");
  const guardians = [guardian1.address, guardian2.address];
  const vaultContract = await VaultContract.deploy(deployer.address, guardians, loanAddress);
  await vaultContract.waitForDeployment();
  const vaultAddress = await vaultContract.getAddress();
  console.log("✅ VaultContract desplegado en:", vaultAddress);

  // 4. Financiar el pool de préstamos
  console.log("\n💰 Financiando el pool de préstamos...");
  const fundAmount = hre.ethers.parseUnits("10000", 18); // 10,000 PYUSD
  await pyusd.approve(loanAddress, fundAmount);
  await loanContract.fundPool(fundAmount);
  console.log("✅ Pool financiado con 10,000 PYUSD");

  // 5. Dar tokens PYUSD al deployer para pruebas
  console.log("\n🎁 Distribuyendo tokens de prueba...");
  const testAmount = hre.ethers.parseUnits("1000", 18); // 1,000 PYUSD
  await pyusd.faucet(deployer.address, testAmount);
  console.log("✅ 1,000 PYUSD enviados al deployer");

  // 6. Mostrar resumen
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DESPLIEGUE COMPLETADO PARA LA HACKATHON");
  console.log("=".repeat(60));
  console.log("📋 DIRECCIONES DE CONTRATOS:");
  console.log("   MockPYUSD:", pyusdAddress);
  console.log("   LoanContract:", loanAddress);
  console.log("   VaultContract:", vaultAddress);
  console.log("\n👥 CUENTAS DE PRUEBA:");
  console.log("   Deployer:", deployer.address);
  console.log("   Guardian 1:", guardian1.address);
  console.log("   Guardian 2:", guardian2.address);
  console.log("\n🔧 ACTUALIZA TU FRONTEND:");
  console.log(`   PYUSD_CONTRACT_ADDRESS = "${pyusdAddress}";`);
  console.log(`   VAULT_CONTRACT_ADDRESS = "${vaultAddress}";`);
  console.log(`   LOAN_CONTRACT_ADDRESS = "${loanAddress}";`);
  console.log("=".repeat(60));

  // 7. Guardar direcciones en archivo
  const fs = require('fs');
  const addresses = {
    pyusd: pyusdAddress,
    loanContract: loanAddress,
    vaultContract: vaultAddress,
    deployer: deployer.address,
    guardian1: guardian1.address,
    guardian2: guardian2.address
  };
  
  fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("📝 Direcciones guardadas en deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });