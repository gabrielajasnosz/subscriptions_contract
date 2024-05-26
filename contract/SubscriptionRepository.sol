// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SubscriptionService {
    address public owner;
    uint256 public subscriptionFee;
    uint256 public subscriptionPeriod = 60 seconds;

    struct Subscriber {
        uint256 nextPaymentDue;
        bool isSubscribed;
        string email;
        string firstName;
        string lastName;
    }

    struct SubscriberInfo {
        address subscriberAddress;
        uint256 nextPaymentDue;
        bool isSubscribed;
        string email;
        string firstName;
        string lastName;
        bool isSubscriptionActive;
    }

    mapping(address => Subscriber) public subscribers;
    address[] public subscriberAddresses;

    event Subscribed(address indexed subscriber, uint256 nextPaymentDue, string email, string firstName, string lastName);
    event Unsubscribed(address indexed subscriber);
    event Payment(address indexed subscriber, uint256 amount, uint256 nextPaymentDue);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    modifier isSubscribed() {
        require(subscribers[msg.sender].isSubscribed, "Not subscribed");
        _;
    }

    constructor(uint256 _subscriptionFee) {
        owner = msg.sender;
        subscriptionFee = _subscriptionFee;
    }

    function subscribe(string memory email, string memory firstName, string memory lastName) external payable {
        require(msg.value == subscriptionFee, "Incorrect subscription fee");
        require(!subscribers[msg.sender].isSubscribed, "Already subscribed");

        subscribers[msg.sender] = Subscriber(block.timestamp + subscriptionPeriod, true, email, firstName, lastName);
        subscriberAddresses.push(msg.sender);
        emit Subscribed(msg.sender, block.timestamp + subscriptionPeriod, email, firstName, lastName);
    }

    function unsubscribe() external isSubscribed {
        subscribers[msg.sender].isSubscribed = false;
        emit Unsubscribed(msg.sender);
    }

    function makePayment() external payable isSubscribed {
        require(msg.value == subscriptionFee, "Incorrect subscription fee");
        require(block.timestamp >= subscribers[msg.sender].nextPaymentDue, "Payment not due yet");

        subscribers[msg.sender].nextPaymentDue = block.timestamp + subscriptionPeriod;
        emit Payment(msg.sender, msg.value, subscribers[msg.sender].nextPaymentDue);
    }

    function checkSubscription(address subscriber) external view returns (bool isActive, uint256 nextPaymentDue, string memory email, string memory firstName, string memory lastName) {
        Subscriber memory sub = subscribers[subscriber];
        bool isSubscriptionActive = sub.isSubscribed && (block.timestamp < sub.nextPaymentDue);
        return (isSubscriptionActive, sub.nextPaymentDue, sub.email, sub.firstName, sub.lastName);
    }

    function getAllSubscribers() external view onlyOwner returns (SubscriberInfo[] memory) {
        SubscriberInfo[] memory allSubscribers = new SubscriberInfo[](subscriberAddresses.length);
        for (uint256 i = 0; i < subscriberAddresses.length; i++) {
            address addr = subscriberAddresses[i];
            Subscriber memory sub = subscribers[addr];
            bool isSubscriptionActive = sub.isSubscribed && (block.timestamp < sub.nextPaymentDue);
            allSubscribers[i] = SubscriberInfo(addr, sub.nextPaymentDue, sub.isSubscribed, sub.email, sub.firstName, sub.lastName, isSubscriptionActive);
        }
        return allSubscribers;
    }

    function withdrawFunds() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function updateSubscriptionFee(uint256 newFee) external onlyOwner {
        subscriptionFee = newFee;
    }

    function isOwner() external view returns (bool) {
        return msg.sender == owner;
    }

    function isSubscribedUser(address user) external view returns (bool) {
        return subscribers[user].isSubscribed;
    }
}
