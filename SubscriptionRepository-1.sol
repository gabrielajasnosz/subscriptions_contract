pragma experimental ABIEncoderV2;
pragma solidity ^0.5.0;

contract SubscriptionService {
    address public owner;
    uint256 public subscriptionFee;
    uint256 public subscriptionPeriod = 60 seconds;

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


    constructor(uint256 _subscriptionFee) public {
        owner = msg.sender;
        subscriptionFee = _subscriptionFee;
    }

    function subscribe(string memory email, string memory firstName, string memory lastName) public payable {
        require(msg.value == subscriptionFee, "Incorrect subscription fee");
        require(!subscribers[msg.sender].isSubscribed, "Already subscribed");

        subscribers[msg.sender] = Subscriber(block.timestamp + subscriptionPeriod, true, email, firstName, lastName);
        subscriberAddresses.push(msg.sender);
        emit Subscribed(msg.sender, block.timestamp + subscriptionPeriod, email, firstName, lastName);
    }

    function unsubscribe() public {
        subscribers[msg.sender].isSubscribed = false;
        emit Unsubscribed(msg.sender);
    }

    function makePayment() public payable {
        require(msg.value == subscriptionFee, "Incorrect subscription fee");
        require(block.timestamp >= subscribers[msg.sender].subscriptionDue, "Payment not due yet");

        subscribers[msg.sender].subscriptionDue = block.timestamp + subscriptionPeriod;
        emit Payment(msg.sender, msg.value, subscribers[msg.sender].subscriptionDue);
    }

    function checkSubscription(address subscriber) public view returns (bool isActive, uint256 subscriptionDue, string memory email, string memory firstName, string memory lastName) {
        Subscriber memory sub = subscribers[subscriber];
        bool isSubscriptionActive = sub.isSubscribed && (block.timestamp < sub.subscriptionDue);
        return (isSubscriptionActive, sub.subscriptionDue, sub.email, sub.firstName, sub.lastName);
    }

    function getAllSubscribers() public view returns (SubscriberInfo[] memory) {
        SubscriberInfo[] memory allSubscribers = new SubscriberInfo[](subscriberAddresses.length);
        for (uint256 i = 0; i < subscriberAddresses.length; i++) {
            address addr = subscriberAddresses[i];
            Subscriber memory sub = subscribers[addr];
            bool isSubscriptionActive = sub.isSubscribed && (block.timestamp < sub.subscriptionDue);
            allSubscribers[i] = SubscriberInfo(addr, sub.subscriptionDue, sub.isSubscribed, sub.email, sub.firstName, sub.lastName, isSubscriptionActive);
        }
        return allSubscribers;
    }

    function withdrawFunds() public {
        address(uint160(owner)).transfer(address(this).balance);
    }

    function updateSubscriptionFee(uint256 newFee) public {
        subscriptionFee = newFee;
    }

    function selfDestructContract() public payable {
        selfdestruct(address(uint160(owner)));
        emit Destroyed(msg.sender);
    }

    function isOwner() public view returns (bool) {
        return msg.sender == owner;
    }

    function isSubscribedUser(address user) public view returns (bool) {
        return subscribers[user].isSubscribed;
    }
}
