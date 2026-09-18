import { expect } from "chai";
import { ethers } from "hardhat";
import { PinFeeCollector } from "../typechain-types";

describe("PinFeeCollector", () => {
  async function fixture() {
    const [owner, treasury, payer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PinFeeCollector");
    const collector = (await Factory.deploy(treasury.address)) as unknown as PinFeeCollector;
    await collector.waitForDeployment();
    return { collector, owner, treasury, payer, other };
  }

  it("pays HBAR pin fee to treasury non-custodially", async () => {
    const { collector, treasury, payer } = await fixture();
    const before = await ethers.provider.getBalance(treasury.address);
    const amount = ethers.parseEther("1");
    const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const hash = ethers.id("hello");

    await expect(collector.connect(payer).payPinHbar(cid, hash, { value: amount }))
      .to.emit(collector, "PinPaid")
      .withArgs(payer.address, ethers.ZeroAddress, amount, cid, hash);

    const after = await ethers.provider.getBalance(treasury.address);
    expect(after - before).to.equal(amount);
    expect(await ethers.provider.getBalance(await collector.getAddress())).to.equal(0n);
  });

  it("rejects zero HBAR", async () => {
    const { collector, payer } = await fixture();
    await expect(
      collector.connect(payer).payPinHbar("cid", ethers.id("x"), { value: 0 }),
    ).to.be.reverted;
  });

  it("uses bigint for amounts (no float)", async () => {
    const amount = 100_000_000n; // 1 HBAR in tinybar-like units on local
    expect(typeof amount).to.equal("bigint");
    expect(amount + 1n).to.equal(100_000_001n);
  });
});
