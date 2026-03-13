const hre = require("hardhat");

async function main() {
    const HealthRecord = await hre.ethers.getContractFactory("HealthRecord");
    const contract = await HealthRecord.deploy();
    await contract.waitForDeployment();

    console.log("HealthRecord deployed to:", await contract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
