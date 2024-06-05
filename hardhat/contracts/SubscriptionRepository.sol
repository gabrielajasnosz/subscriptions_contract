// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract SubscriptionService {
    address payable public immutable owner;
    uint256 public subscriptionFee;
    uint256 public constant subscriptionPeriod = 60 seconds;

    mapping(address => bool) public isAddressInList;

    struct Subscriber {
        uint256 subscriptionDue;
        bool isSubscribed;
        string email;
        string firstName;
        string lastName;
    }

    struct SubscriberInfo {
        address subscriberAddress;
        uint256 subscriptionDue;
        bool isSubscribed;
        string email;
        string firstName;
        string lastName;
        bool isSubscriptionActive;
    }

    mapping(address => Subscriber) public subscribers;
    address[] public subscriberAddresses;

    event Subscribed(address indexed subscriber, uint256 subscriptionDue, string email, string firstName, string lastName);
    event Unsubscribed(address indexed subscriber);
    event Payment(address indexed subscriber, uint256 amount, uint256 subscriptionDue);
    event Destroyed(address indexed subscriber);
    event SubscriptionFeeUpdated(uint256 newFee);

    constructor(uint256 _subscriptionFee) {
        owner = payable(msg.sender);
        subscriptionFee = _subscriptionFee;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    function currentTime() internal view returns (uint256) {
        return block.timestamp;
    }

    function subscribe(string calldata email, string calldata firstName, string calldata lastName) external payable {
        require(msg.value == subscriptionFee, "Incorrect subscription fee");
        require(!subscribers[msg.sender].isSubscribed, "Already subscribed");
        require(bytes(email).length > 0 && bytes(email).length <= 100, "Email cannot be empty or exceed 100 characters");
        require(bytes(firstName).length > 0 && bytes(firstName).length <= 50, "First name cannot be empty or exceed 50 characters");
        require(bytes(lastName).length > 0 && bytes(lastName).length <= 50, "Last name cannot be empty or exceed 50 characters");
        require(isValidEmail(email), "Invalid email format");
        require(!isAddressInList[msg.sender], "Address already in list");

        uint256 timeNow = currentTime();
        subscribers[msg.sender] = Subscriber(timeNow + subscriptionPeriod, true, email, firstName, lastName);
        subscriberAddresses.push(msg.sender);
        isAddressInList[msg.sender] = true;

        emit Subscribed(msg.sender, timeNow + subscriptionPeriod, email, firstName, lastName);
    }

    function unsubscribe() external {
        require(subscribers[msg.sender].isSubscribed, "You must have a subscription to unsubscribe");

        subscribers[msg.sender].isSubscribed = false;
        isAddressInList[msg.sender] = false;
        emit Unsubscribed(msg.sender);
    }

    function makePayment() external payable {
        require(subscribers[msg.sender].isSubscribed, "You must have a subscription to make a payment");
        require(msg.value == subscriptionFee, "Incorrect subscription fee");

        uint256 timeNow = currentTime();
        require(timeNow >= subscribers[msg.sender].subscriptionDue, "Payment not due yet");

        subscribers[msg.sender].subscriptionDue = timeNow + subscriptionPeriod;
        emit Payment(msg.sender, msg.value, subscribers[msg.sender].subscriptionDue);
    }

    function checkSubscription(address subscriber) public view returns (bool isActive, uint256 subscriptionDue, string memory email, string memory firstName, string memory lastName) {
        Subscriber memory sub = subscribers[subscriber];
        uint256 timeNow = currentTime();
        bool isSubscriptionActive = sub.isSubscribed && (timeNow < sub.subscriptionDue);
        return (isSubscriptionActive, sub.subscriptionDue, sub.email, sub.firstName, sub.lastName);
    }

    function getAllSubscribers() public view onlyOwner returns (SubscriberInfo[] memory) {
        require(subscriberAddresses.length > 0, "No subscribers found");
        uint256 length = subscriberAddresses.length;  // Buffering the length of the array
        SubscriberInfo[] memory allSubscribers = new SubscriberInfo[](length);
        for (uint256 i = 0; i < length; i++) {
            address addr = subscriberAddresses[i];
            Subscriber memory sub = subscribers[addr];
            uint256 timeNow = currentTime();
            bool isSubscriptionActive = sub.isSubscribed && (timeNow < sub.subscriptionDue);
            allSubscribers[i] = SubscriberInfo(addr, sub.subscriptionDue, sub.isSubscribed, sub.email, sub.firstName, sub.lastName, isSubscriptionActive);
        }
        return allSubscribers;
    }

    function withdrawFunds() public onlyOwner {
        owner.transfer(address(this).balance);
    }

    function updateSubscriptionFee(uint256 newFee) public onlyOwner {
        subscriptionFee = newFee;
        emit SubscriptionFeeUpdated(newFee);
    }

    function selfDestructContract() public payable onlyOwner {
        selfdestruct(owner);
        emit Destroyed(msg.sender);
    }

    function isOwner() public view returns (bool) {
        return msg.sender == owner;
    }

    function isSubscribedUser(address user) public view returns (bool) {
        return subscribers[user].isSubscribed;
    }

    function isValidEmail(string memory email) internal pure returns (bool) {
        bytes memory emailBytes = bytes(email);
        bool hasAtSymbol = false;
        for (uint256 i = 0; i < emailBytes.length; i++) {
            if (emailBytes[i] == "@") {
                hasAtSymbol = true;
                break;
            }
        }
        return hasAtSymbol;
    }
}