const hre = require("hardhat");

async function main() {
  console.log("🚀 Desplegando contratos en Sepolia...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // PYUSD ya existe en Sepolia
  const PYUSD_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

  // 1. Desplegar SimpleLoan
  console.log("🏦 Desplegando SimpleLoan...");
  const SimpleLoan = await hre.ethers.getContractFactory("SimpleLoan");
  const loanContract = await SimpleLoan.deploy(PYUSD_ADDRESS, "0x0000000000000000000000000000000000000000");
  await loanContract.waitForDeployment();
  const loanAddress = await loanContract.getAddress();
  console.log("✅ SimpleLoan:", loanAddress);

  // 2. Desplegar SimpleVault
  console.log("🔐 Desplegando SimpleVault...");
  const SimpleVault = await hre.ethers.getContractFactory("SimpleVault");
  const guardians = []; // Sin guardianes iniciales
  const vaultContract = await SimpleVault.deploy(deployer.address, guardians, loanAddress);
  await vaultContract.waitForDeployment();
  const vaultAddress = await vaultContract.getAddress();
  console.log("✅ SimpleVault:", vaultAddress);

  console.log("\n🎉 CONTRATOS DESPLEGADOS EN SEPOLIA");
  console.log("PYUSD:", PYUSD_ADDRESS);
  console.log("SimpleLoan:", loanAddress);
  console.log("SimpleVault:", vaultAddress);

  const fs = require('fs');
  const addresses = {
    pyusd: PYUSD_ADDRESS,
    loanContract: loanAddress,
    vaultContract: vaultAddress,
    deployer: deployer.address
  };
  
  fs.writeFileSync('sepolia-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("📝 Direcciones guardadas en sepolia-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });