import {assert, expect} from "chai";
import pkg from 'hardhat';

const {ethers} = pkg;

describe("SubscriptionService", function () {
    let SubscriptionService;
    let subscriptionService;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    const subscriptionFee = ethers.utils.parseEther("1");

    beforeEach(async function () {
        SubscriptionService = await ethers.getContractFactory("SubscriptionService");
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        subscriptionService = await SubscriptionService.deploy(subscriptionFee);
        await subscriptionService.deployed();
    });

    describe("Initial State", function () {
        it("1. Should set the right owner", async function () {
            expect(await subscriptionService.owner()).to.equal(owner.address);
        });

        it("2. Should set the subscription fee correctly", async function () {
            expect(await subscriptionService.subscriptionFee()).to.equal(subscriptionFee);
        });
    });

    describe("Subscriptions", function () {

        it("3. Should allow user to subscribe", async function () {
            const currentBlock = await ethers.provider.getBlock("latest");

            const tx = await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'Subscribed');

            const minExpectedTimestamp = currentBlock.timestamp + 60;
            const maxExpectedTimestamp = currentBlock.timestamp + 61;

            expect(event.args[0]).to.equal(addr1.address);
            expect(event.args[2]).to.equal("test@example.com");
            expect(event.args[3]).to.equal("John");
            expect(event.args[4]).to.equal("Doe");
            expect(event.args[1].toNumber()).to.be.within(minExpectedTimestamp, maxExpectedTimestamp);

            const subscription = await subscriptionService.subscribers(addr1.address);
            expect(subscription.isSubscribed).to.be.true;
            expect(subscription.subscriptionDue).to.be.within(minExpectedTimestamp, maxExpectedTimestamp);
        });

        it("4. Should not allow user to subscribe with incorrect fee", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: ethers.utils.parseEther("0.5") })
            ).to.be.revertedWith("Incorrect subscription fee");
        });

        it("5. Should not allow user to subscribe twice", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });

            await expect(
                subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee })
            ).to.be.revertedWith("Already subscribed");
        });

        it("6. Should allow user to unsubscribe", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await expect(subscriptionService.connect(addr1).unsubscribe()).to.emit(subscriptionService, "Unsubscribed").withArgs(addr1.address);

            const subscription = await subscriptionService.subscribers(addr1.address);
            expect(subscription.isSubscribed).to.be.false;
        });

        it("7. Should not allow an unsubscribed user to unsubscribe", async function () {
            await expect(subscriptionService.connect(addr1).unsubscribe()).to.be.revertedWith("Not subscribed");
        });

        it("8. Should not allow user to subscribe without payment", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: 0 })
            ).to.be.revertedWith("Incorrect subscription fee");
        });

        it("9. Should not allow user to subscribe with insufficient payment", async function () {
            const insufficientFee = subscriptionFee.div(2); // Assuming subscriptionFee is a BigNumber
            await expect(
                subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: insufficientFee })
            ).to.be.revertedWith("Incorrect subscription fee");
        });
    });

    describe("Payments", function () {

        it("10. Should allow user to make a payment", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await ethers.provider.send("evm_increaseTime", [61]); // Increase time by 61 seconds to make the payment due
            await ethers.provider.send("evm_mine"); // Mine a new block to reflect the time increase

            const currentBlock = await ethers.provider.getBlock("latest");

            const tx = await subscriptionService.connect(addr1).makePayment({ value: subscriptionFee });
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'Payment');

            assert(event, 'Payment event not found');

            const minExpectedTimestamp = currentBlock.timestamp + 60;
            const maxExpectedTimestamp = currentBlock.timestamp + 61;

            expect(event.args[0]).to.equal(addr1.address);
            expect(event.args[1]).to.equal(subscriptionFee);
            expect(event.args[2].toNumber()).to.be.within(minExpectedTimestamp, maxExpectedTimestamp);

            const subscription = await subscriptionService.subscribers(addr1.address);
            expect(subscription.subscriptionDue).to.be.above(currentBlock.timestamp);
            expect(subscription.subscriptionDue).to.be.within(minExpectedTimestamp, maxExpectedTimestamp);
        });

        it("11. Should not allow user to make a payment with incorrect fee", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await ethers.provider.send("evm_increaseTime", [61]); // Increase time by 61 seconds to make the payment due
            await ethers.provider.send("evm_mine"); // Mine a new block to reflect the time increase

            await expect(subscriptionService.connect(addr1).makePayment({ value: ethers.utils.parseEther("0.5") }))
                .to.be.revertedWith("Incorrect subscription fee");
        });

        it("12. Should not allow user to make a payment before it's due", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });

            await expect(subscriptionService.connect(addr1).makePayment({ value: subscriptionFee }))
                .to.be.revertedWith("Payment not due yet");
        });

        it("13. Should not allow user to make a payment if not subscribed", async function () {
            await expect(subscriptionService.connect(addr1).makePayment({ value: subscriptionFee }))
                .to.be.revertedWith("Not subscribed");
        });

        it("14. Should not allow user to make a payment with insufficient amount", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await ethers.provider.send("evm_increaseTime", [61]); // Increase time by 61 seconds to make the payment due
            await ethers.provider.send("evm_mine"); // Mine a new block to reflect the time increase

            const insufficientFee = subscriptionFee.div(2);
            await expect(subscriptionService.connect(addr1).makePayment({ value: insufficientFee }))
                .to.be.revertedWith("Incorrect subscription fee");
        });
    });

    describe("Owner Functions", function () {
        it("15. Should allow the owner to withdraw funds", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

            const txResponse = await subscriptionService.withdrawFunds();
            await txResponse.wait();  // Wait for the transaction to be mined

            const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
            const subscriptionFeeBN = ethers.BigNumber.from(subscriptionFee);
            expect(finalOwnerBalance.sub(initialOwnerBalance)).to.be.closeTo(subscriptionFeeBN, ethers.utils.parseEther("0.01"));  // Allow a small deviation for gas costs
        });

        it("16. Should not allow a non-owner to withdraw funds", async function () {
            await expect(subscriptionService.connect(addr1).withdrawFunds()).to.be.revertedWith("Not the contract owner");
        });

        it("17. Should allow the owner to update the subscription fee", async function () {
            const newFee = ethers.utils.parseEther("2");
            await subscriptionService.updateSubscriptionFee(newFee);

            expect(await subscriptionService.subscriptionFee()).to.equal(newFee);
        });

        it("18. Should not allow a non-owner to update the subscription fee", async function () {
            const newFee = ethers.utils.parseEther("2");

            await expect(subscriptionService.connect(addr1).updateSubscriptionFee(newFee)).to.be.revertedWith("Not the contract owner");
        });
    });

    describe("View Functions", function () {
        it("19. Should return correct subscription details for user", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            const [isActive, subscriptionDue, email, firstName, lastName] = await subscriptionService.checkSubscription(addr1.address);

            expect(isActive).to.be.true;
            expect(email).to.equal("test@example.com");
            expect(firstName).to.equal("John");
            expect(lastName).to.equal("Doe");
        });

        it("20. Should correctly identify the owner", async function () {
            expect(await subscriptionService.isOwner()).to.be.true;
            expect(await subscriptionService.connect(addr1).isOwner()).to.be.false;
        });

        it("21. Should correctly identify if user is subscribed", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            expect(await subscriptionService.isSubscribedUser(addr1.address)).to.be.true;
            expect(await subscriptionService.isSubscribedUser(addr2.address)).to.be.false;
        });

        it("22. Should return all subscribers for the owner", async function () {
            await subscriptionService.connect(addr1).subscribe("test1@example.com", "John", "Doe", { value: subscriptionFee });
            await subscriptionService.connect(addr2).subscribe("test2@example.com", "Jane", "Doe", { value: subscriptionFee });

            const subscribers = await subscriptionService.getAllSubscribers();
            expect(subscribers.length).to.equal(2);

            expect(subscribers[0].email).to.equal("test1@example.com");
            expect(subscribers[1].email).to.equal("test2@example.com");
        });

        it("23. Should not allow non-owner to get all subscribers", async function () {
            await expect(subscriptionService.connect(addr1).getAllSubscribers()).to.be.revertedWith("Not the contract owner");
        });
    });
});
