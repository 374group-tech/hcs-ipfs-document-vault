import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const treasury =
    process.env.PIN_TREASURY_EVM_ADDRESS ||
    process.env.PIN_TREASURY_ACCOUNT_ID ||
    deployer;

  // If PIN_TREASURY_ACCOUNT_ID is a Hedera 0.0.x id, deployer is used as treasury
  // for local/demo; set PIN_TREASURY_EVM_ADDRESS for real testnet deploys.
  const treasuryAddress =
    typeof treasury === "string" && treasury.startsWith("0x") ? treasury : deployer;

  log(`Deploying PinFeeCollector on ${network.name}; treasury=${treasuryAddress}`);

  const result = await deploy("PinFeeCollector", {
    from: deployer,
    args: [treasuryAddress],
    log: true,
    autoMine: true,
  });

  log(`PinFeeCollector: ${result.address}`);
};

export default func;
func.tags = ["PinFeeCollector"];
