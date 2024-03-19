const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("AucEngine", function () {
  async function deploy() {
    [owner, seller, buyer] = await ethers.getSigners();

    const AucEngine = await ethers.getContractFactory("AucEngine", owner);
    const auct = await AucEngine.deploy();
    await auct.waitForDeployment();

    return { owner, seller, buyer, auct };
  }

  it("sets owner", async function () {
    const { owner, auct } = await loadFixture(deploy);

    const currentOwner = await auct.owner();

    expect(currentOwner).to.eq(owner.address);
  });

  async function getTimestamp(bn) {
    return (await ethers.provider.getBlock(bn)).timestamp;
  }

  describe("createAuction", function () {
    it("creates auction correctly", async function () {
      const { auct } = await loadFixture(deploy);
      const duration = 60;

      const tx = await auct.createAuction(
        ethers.parseEther("0.0001"),
        3,
        "fake item",
        duration
      );

      const cAuction = await auct.auctions(0); // Promise
      expect(cAuction.item).to.eq("fake item");
      const ts = await getTimestamp(tx.blockNumber);
      expect(cAuction.endsAt).to.eq(ts + duration);
    });
  });

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  describe("buy", function () {
    it("allows to buy", async function () {
      const { auct } = await loadFixture(deploy);
      await auct
        .connect(seller)
        .createAuction(ethers.parseEther("0.0001"), 3, "fake item", 60);

      this.timeout(5000); // 5s
      await delay(1000);

      const buyTx = await auct
        .connect(buyer)
        .buy(0, { value: ethers.parseEther("0.0001") });

      const cAuction = await auct.auctions(0);
      const finalPrice = cAuction.finalPrice;
      await expect(() => buyTx).to.changeEtherBalance(
        seller,
        BigInt(finalPrice) - (BigInt(finalPrice) * BigInt(10)) / BigInt(100)
      );

      await expect(buyTx)
        .to.emit(auct, "AuctionEnded")
        .withArgs(0, finalPrice, buyer.address);

      await expect(
        auct.connect(buyer).buy(0, { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("stopped!");
    });
  });
});
