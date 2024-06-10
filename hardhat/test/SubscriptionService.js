import { assert, expect } from "chai";
import pkg from 'hardhat';

const { ethers } = pkg;

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
        it("1. Should allow user to subscribe with correct fee and correct parameters", async function () {
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

        it("2. Should not allow user to subscribe with invalid email", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("invalid-email", "John", "Doe", { value: subscriptionFee })
            ).to.be.revertedWith("Invalid email format");
        });

        it("3. Should not allow user to subscribe with too long email", async function () {
            const longString = 'a'.repeat(101);
            await expect(
                subscriptionService.connect(addr1).subscribe(longString, "name", "surname", { value: subscriptionFee })
            ).to.be.revertedWith("Email cannot be empty or exceed 100 characters");
        });

        it("4. Should not allow user to subscribe with too long name", async function () {
            const longString = 'a'.repeat(101);
            await expect(
                subscriptionService.connect(addr1).subscribe("mail@mail.com", longString, "surname", { value: subscriptionFee })
            ).to.be.revertedWith("First name cannot be empty or exceed 50 characters'");
        });

        it("5. Should not allow user to subscribe with too long last name", async function () {
            const longString = 'a'.repeat(101);
            await expect(
                subscriptionService.connect(addr1).subscribe("mail@mail.com", "name", longString, { value: subscriptionFee })
            ).to.be.revertedWith("Last name cannot be empty or exceed 50 characters");
        });

        it("6. Should not allow user to subscribe with incorrect fee", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: ethers.utils.parseEther("0.5") })
            ).to.be.revertedWith("Incorrect subscription fee");
        });

        it("7. Should not allow user to subscribe with empty email", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("", "Name", "Surname", { value: subscriptionFee })
            ).to.be.revertedWith("Email cannot be empty or exceed 100 characters");
        });

        it("8. Should not allow user to subscribe with empty name", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("email@email.com", "", "surname", { value: subscriptionFee })
            ).to.be.revertedWith("First name cannot be empty or exceed 50 characters");
        });

        it("9. Should not allow user to subscribe with empty last name", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("email@email.com", "name", "", { value: subscriptionFee })
            ).to.be.revertedWith("Last name cannot be empty or exceed 50 characters");
        });

        it("10. Should allow subscribed user to unsubscribe", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await expect(subscriptionService.connect(addr1).unsubscribe()).to.emit(subscriptionService, "Unsubscribed").withArgs(addr1.address);

            const subscription = await subscriptionService.subscribers(addr1.address);
            expect(subscription.isSubscribed).to.be.false;
        });

        it("11. Should not allow unsubscribed user to unsubscribe", async function () {
            await expect(subscriptionService.connect(addr1).unsubscribe()).to.be.revertedWith("You must have a subscription to unsubscribe");
        });

        it("12. Should allow owner to update the subscription fee", async function () {
            const newFee = ethers.utils.parseEther("2");
            await subscriptionService.updateSubscriptionFee(newFee);

            expect(await subscriptionService.subscriptionFee()).to.equal(newFee);
        });

        it("13. Should not allow non-owner to update the subscription fee", async function () {
            const newFee = ethers.utils.parseEther("2");

            await expect(subscriptionService.connect(addr1).updateSubscriptionFee(newFee)).to.be.revertedWith("Only the owner can call this function");
        });

        it("14. Should allow the owner to withdraw funds", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

            const txResponse = await subscriptionService.withdrawFunds();
            await txResponse.wait();  // Wait for the transaction to be mined

            const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
            const subscriptionFeeBN = ethers.BigNumber.from(subscriptionFee);
            expect(finalOwnerBalance.sub(initialOwnerBalance)).to.be.closeTo(subscriptionFeeBN, ethers.utils.parseEther("0.01"));  // Allow a small deviation for gas costs
        });

        it("15. Should not allow a non-owner to withdraw funds", async function () {
            await expect(subscriptionService.connect(addr1).withdrawFunds()).to.be.revertedWith("Only the owner can call this function");
        });

        it("16. Should allow owner to self-destruct the contract", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            const txResponse = await subscriptionService.connect(owner).selfDestructContract();
            await txResponse.wait();

            await expect(subscriptionService.connect(addr1).subscribe("test2@example.com", "Jane", "Doe", { value: subscriptionFee }))
                .to.be.reverted;
        });

        it("17. Should not allow non-owner to self-destruct the contract", async function () {
            await expect(subscriptionService.connect(addr1).selfDestructContract()).to.be.revertedWith("Only the owner can call this function");
        });

        it("18. Should allow user to make a payment when due", async function () {
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

        it("19. Should not allow user to make a payment with incorrect fee", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await ethers.provider.send("evm_increaseTime", [61]); // Increase time by 61 seconds to make the payment due
            await ethers.provider.send("evm_mine"); // Mine a new block to reflect the time increase

            await expect(subscriptionService.connect(addr1).makePayment({ value: ethers.utils.parseEther("0.5") }))
                .to.be.revertedWith("Incorrect subscription fee");
        });

        it("20. Should not allow non-subscribed user to make a payment", async function () {
            await expect(subscriptionService.connect(addr1).makePayment({ value: subscriptionFee }))
                .to.be.revertedWith("You must have a subscription to make a payment");
        });

        it("21. Should not allow user to make a payment before it's due", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });

            await expect(subscriptionService.connect(addr1).makePayment({ value: subscriptionFee }))
                .to.be.revertedWith("Payment not due yet");
        });


        it("22. Should not allow user to subscribe multiple times without unsubscribing", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await expect(
                subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee })
            ).to.be.revertedWith("Already subscribed");
        });

        it("23. Should not allow user to unsubscribe multiple times", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            await subscriptionService.connect(addr1).unsubscribe();
            await expect(subscriptionService.connect(addr1).unsubscribe()).to.be.revertedWith("You must have a subscription to unsubscribe");
        });

        it("24. Should validate email format", async function () {
            await expect(
                subscriptionService.connect(addr1).subscribe("invalid-email-format", "John", "Doe", { value: subscriptionFee })
            ).to.be.revertedWith("Invalid email format");
        });

        it("25. Should not allow subscription when exceeding maximum character limits", async function () {
            const longEmail = 'a'.repeat(101) + '@example.com';
            const longName = 'a'.repeat(51);
            await expect(
                subscriptionService.connect(addr1).subscribe(longEmail, longName, longName, { value: subscriptionFee })
            ).to.be.revertedWith("Email cannot be empty or exceed 100 characters");
        });
    });

    describe("View Functions", function () {
        it("1. Should return correct subscription details for user", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            const [isActive, subscriptionDue, email, firstName, lastName] = await subscriptionService.checkSubscription(addr1.address);

            expect(isActive).to.be.true;
            expect(email).to.equal("test@example.com");
            expect(firstName).to.equal("John");
            expect(lastName).to.equal("Doe");
        });

        it("2. Should correctly identify the owner", async function () {
            expect(await subscriptionService.isOwner()).to.be.true;
            expect(await subscriptionService.connect(addr1).isOwner()).to.be.false;
        });

        it("3. Should correctly identify if user is subscribed", async function () {
            await subscriptionService.connect(addr1).subscribe("test@example.com", "John", "Doe", { value: subscriptionFee });
            expect(await subscriptionService.isSubscribedUser(addr1.address)).to.be.true;
            expect(await subscriptionService.isSubscribedUser(addr2.address)).to.be.false;
        });

        it("4. Should return all subscribers for the owner", async function () {
            await subscriptionService.connect(addr1).subscribe("test1@example.com", "John", "Doe", { value: subscriptionFee });
            await subscriptionService.connect(addr2).subscribe("test2@example.com", "Jane", "Doe", { value: subscriptionFee });

            const subscribers = await subscriptionService.getAllSubscribers();
            expect(subscribers.length).to.equal(2);

            expect(subscribers[0].email).to.equal("test1@example.com");
            expect(subscribers[1].email).to.equal("test2@example.com");
        });

        it("5. Should not allow non-owner to get all subscribers", async function () {
            await subscriptionService.connect(addr1).subscribe("test1@example.com", "John", "Doe", { value: subscriptionFee });
            await subscriptionService.connect(addr2).subscribe("test2@example.com", "Jane", "Doe", { value: subscriptionFee });

            await expect(subscriptionService.connect(addr1).getAllSubscribers()).to.be.revertedWith("Only the owner can call this function");
        });
    });

});
