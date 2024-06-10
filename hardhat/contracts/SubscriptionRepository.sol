// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract SubscriptionService {
    address payable public immutable owner;
    uint256 public subscriptionFee;
    uint256 public constant subscriptionPeriod = 60 seconds;
    bool private locked = false;
    mapping(address => bool) public isAddressInList;

    struct Subscriber {
        uint256 subscriptionDue;
        bool isSubscribed;
        string email;
        string firstName;
        string lastName;
    }

    struct SubscriptionHistory {
        address subscriberAddress;
        uint256 subscriptionStart;
        uint256 subscriptionValidTill;
        uint256 subscriptionEnd;
        string email;
        string firstName;
        string lastName;
    }

    mapping(address => Subscriber) public subscribers;
    mapping(address => SubscriptionHistory[]) public subscriptionHistories;
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

    modifier noReentrancy() {
        require(!locked, "ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
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

        subscriptionHistories[msg.sender].push(SubscriptionHistory({
        subscriberAddress: msg.sender,
        subscriptionStart: timeNow,
        subscriptionValidTill: timeNow + subscriptionPeriod,
        subscriptionEnd: 0,
        email: email,
        firstName: firstName,
        lastName: lastName
        }));

        emit Subscribed(msg.sender, timeNow + subscriptionPeriod, email, firstName, lastName);
    }

    function unsubscribe() external {
        require(subscribers[msg.sender].isSubscribed, "You must have a subscription to unsubscribe");

        uint256 timeNow = currentTime();
        uint256 arrayLenght = subscriptionHistories[msg.sender].length;
        if (arrayLenght > 0) {
            uint256 lastIndex = subscriptionHistories[msg.sender].length - 1;
            if (subscriptionHistories[msg.sender][lastIndex].subscriptionEnd == 0) {
                subscriptionHistories[msg.sender][lastIndex].subscriptionEnd = timeNow;
            }
        }

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

        if (subscriptionHistories[msg.sender].length > 0) {
            uint256 lastIndex = subscriptionHistories[msg.sender].length - 1;
            if (subscriptionHistories[msg.sender][lastIndex].subscriptionEnd == 0) {
                subscriptionHistories[msg.sender][lastIndex].subscriptionEnd = timeNow;
            }
        }

        subscriptionHistories[msg.sender].push(SubscriptionHistory({
        subscriberAddress: msg.sender,
        subscriptionStart: timeNow,
        subscriptionValidTill: timeNow + subscriptionPeriod,
        subscriptionEnd: 0,
        email: subscribers[msg.sender].email,
        firstName: subscribers[msg.sender].firstName,
        lastName: subscribers[msg.sender].lastName
        }));

        emit Payment(msg.sender, msg.value, subscribers[msg.sender].subscriptionDue);
    }

    function checkSubscription(address subscriber) public view returns (bool isActive, uint256 subscriptionDue, string memory email, string memory firstName, string memory lastName) {
        Subscriber memory sub = subscribers[subscriber];
        uint256 timeNow = currentTime();
        bool isSubscriptionActive = sub.isSubscribed && (timeNow < sub.subscriptionDue);
        return (isSubscriptionActive, sub.subscriptionDue, sub.email, sub.firstName, sub.lastName);
    }

    function getAllSubscribers() public view onlyOwner returns (SubscriptionHistory[] memory) {
        uint256 totalSubscriptions = 0;

        uint256 lenght = subscriberAddresses.length;
        for (uint256 i = 0; i < lenght; i++) {
            totalSubscriptions += subscriptionHistories[subscriberAddresses[i]].length;
        }

        SubscriptionHistory[] memory allSubscriptions = new SubscriptionHistory[](totalSubscriptions);
        uint256 index = 0;

        uint256 arrayLength2 = subscriberAddresses.length;
        for (uint256 i = 0; i < arrayLength2; i++) {
            address subscriber = subscriberAddresses[i];
            SubscriptionHistory[] memory histories = subscriptionHistories[subscriber];
            for (uint256 j = 0; j < histories.length; j++) {
                allSubscriptions[index] = histories[j];
                index++;
            }
        }

        return allSubscriptions;
    }

    function withdrawFunds() public onlyOwner noReentrancy {
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