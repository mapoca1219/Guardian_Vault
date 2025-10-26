const hre = require("hardhat");

async function main() {
  console.log("🚀 Desplegando con PYUSD REAL...");

  const [deployer, guardian1, guardian2] = await hre.ethers.getSigners();
  
  console.log("Deployer:", deployer.address);
  console.log("Guardian 1:", guardian1.address);
  console.log("Guardian 2:", guardian2.address);

  // Dirección real de PYUSD en mainnet
  const REAL_PYUSD_ADDRESS = "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8";
  console.log("📄 Usando PYUSD real en:", REAL_PYUSD_ADDRESS);

  // 1. Desplegar SimpleLoan con PYUSD real
  console.log("\n🏦 Desplegando SimpleLoan...");
  const SimpleLoan = await hre.ethers.getContractFactory("SimpleLoan");
  const loanContract = await SimpleLoan.deploy(REAL_PYUSD_ADDRESS, "0x0000000000000000000000000000000000000000");
  await loanContract.waitForDeployment();
  const loanAddress = await loanContract.getAddress();
  console.log("✅ SimpleLoan desplegado en:", loanAddress);

  // 2. Desplegar SimpleVault
  console.log("\n🔐 Desplegando SimpleVault...");
  const SimpleVault = await hre.ethers.getContractFactory("SimpleVault");
  const guardians = [guardian1.address, guardian2.address];
  const vaultContract = await SimpleVault.deploy(deployer.address, guardians, loanAddress);
  await vaultContract.waitForDeployment();
  const vaultAddress = await vaultContract.getAddress();
  console.log("✅ SimpleVault desplegado en:", vaultAddress);

  // 3. Obtener PYUSD para el deployer (impersonate una whale)
  console.log("\n💰 Obteniendo PYUSD real...");
  
  // Impersonate una cuenta con mucho PYUSD
  const whaleAddress = "0x5414d89a8bf7e99d732bc52f3e6a3ef461c0c078"; // Binance wallet
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress],
  });
  
  const whale = await hre.ethers.getSigner(whaleAddress);
  const pyusd = await hre.ethers.getContractAt("IERC20", REAL_PYUSD_ADDRESS);
  
  // Transferir PYUSD al deployer
  const transferAmount = hre.ethers.parseUnits("10000", 6); // PYUSD tiene 6 decimales
  await pyusd.connect(whale).transfer(deployer.address, transferAmount);
  console.log("✅ 10,000 PYUSD transferidos al deployer");

  // 4. Financiar el pool
  console.log("\n🏦 Financiando pool de préstamos...");
  const fundAmount = hre.ethers.parseUnits("5000", 6); // 5,000 PYUSD
  await pyusd.connect(deployer).approve(loanAddress, fundAmount);
  await loanContract.connect(deployer).fundPool(fundAmount);
  console.log("✅ Pool financiado con 5,000 PYUSD");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DESPLIEGUE CON PYUSD REAL COMPLETADO");
  console.log("=".repeat(60));
  console.log("📋 DIRECCIONES:");
  console.log("   PYUSD (Real):", REAL_PYUSD_ADDRESS);
  console.log("   SimpleLoan:", loanAddress);
  console.log("   SimpleVault:", vaultAddress);
  console.log("\n🔧 ACTUALIZA FRONTEND:");
  console.log(`   PYUSD_CONTRACT_ADDRESS = "${REAL_PYUSD_ADDRESS}";`);
  console.log(`   VAULT_CONTRACT_ADDRESS = "${vaultAddress}";`);
  console.log(`   LOAN_CONTRACT_ADDRESS = "${loanAddress}";`);
  console.log("=".repeat(60));

  const fs = require('fs');
  const addresses = {
    pyusd: REAL_PYUSD_ADDRESS,
    loanContract: loanAddress,
    vaultContract: vaultAddress,
    deployer: deployer.address,
    guardian1: guardian1.address,
    guardian2: guardian2.address
  };
  
  fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("📝 Direcciones guardadas");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });