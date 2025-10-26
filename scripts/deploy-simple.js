const hre = require("hardhat");

async function main() {
  console.log("🚀 Desplegando contratos SIMPLES para la hackathon...");

  const [deployer, guardian1, guardian2] = await hre.ethers.getSigners();
  
  console.log("Deployer:", deployer.address);
  console.log("Guardian 1:", guardian1.address);
  console.log("Guardian 2:", guardian2.address);

  // 1. Desplegar SimplePYUSD
  console.log("\n📄 Desplegando SimplePYUSD...");
  const SimplePYUSD = await hre.ethers.getContractFactory("SimplePYUSD");
  const pyusd = await SimplePYUSD.deploy();
  await pyusd.waitForDeployment();
  const pyusdAddress = await pyusd.getAddress();
  console.log("✅ SimplePYUSD desplegado en:", pyusdAddress);

  // 2. Desplegar SimpleLoan
  console.log("\n🏦 Desplegando SimpleLoan...");
  const SimpleLoan = await hre.ethers.getContractFactory("SimpleLoan");
  const loanContract = await SimpleLoan.deploy(pyusdAddress, "0x0000000000000000000000000000000000000000");
  await loanContract.waitForDeployment();
  const loanAddress = await loanContract.getAddress();
  console.log("✅ SimpleLoan desplegado en:", loanAddress);

  // 3. Desplegar SimpleVault
  console.log("\n🔐 Desplegando SimpleVault...");
  const SimpleVault = await hre.ethers.getContractFactory("SimpleVault");
  const guardians = [guardian1.address, guardian2.address];
  const vaultContract = await SimpleVault.deploy(deployer.address, guardians, loanAddress);
  await vaultContract.waitForDeployment();
  const vaultAddress = await vaultContract.getAddress();
  console.log("✅ SimpleVault desplegado en:", vaultAddress);

  // 4. Financiar el pool
  console.log("\n💰 Financiando el pool...");
  const fundAmount = hre.ethers.parseUnits("10000", 18);
  await pyusd.approve(loanAddress, fundAmount);
  await loanContract.fundPool(fundAmount);
  console.log("✅ Pool financiado con 10,000 PYUSD");

  // 5. Dar tokens al deployer
  console.log("\n🎁 Distribuyendo tokens...");
  const testAmount = hre.ethers.parseUnits("1000", 18);
  await pyusd.faucet(deployer.address, testAmount);
  console.log("✅ 1,000 PYUSD enviados al deployer");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DESPLIEGUE COMPLETADO PARA LA HACKATHON");
  console.log("=".repeat(60));
  console.log("📋 DIRECCIONES DE CONTRATOS:");
  console.log("   SimplePYUSD:", pyusdAddress);
  console.log("   SimpleLoan:", loanAddress);
  console.log("   SimpleVault:", vaultAddress);
  console.log("\n👥 CUENTAS DE PRUEBA:");
  console.log("   Deployer:", deployer.address);
  console.log("   Guardian 1:", guardian1.address);
  console.log("   Guardian 2:", guardian2.address);
  console.log("\n🔧 ACTUALIZA TU FRONTEND:");
  console.log(`   PYUSD_CONTRACT_ADDRESS = "${pyusdAddress}";`);
  console.log(`   VAULT_CONTRACT_ADDRESS = "${vaultAddress}";`);
  console.log(`   LOAN_CONTRACT_ADDRESS = "${loanAddress}";`);
  console.log("=".repeat(60));

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