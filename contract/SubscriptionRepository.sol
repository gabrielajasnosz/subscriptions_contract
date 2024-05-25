// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

contract SubscriptionRegistry {
    mapping(address => bool) public admins;
    mapping(string => Subscription) subscriptions;
    string[] subscriptionIds;

    struct Subscription {
        string subscriptionId;
        uint256 activationDate;
        uint256 expirationDate;
        string subscriptionName;
        SubscriptionOwner subscriptionOwner;
    }

    struct SubscriptionOwner {
        string name;
        string surname;
        string email;
    }

    //    event SuccessfullyAddedSubscription(
    //        string indexed subscriptionId,
    //        string recipientName,
    //        string recipientSurname,
    //        string recipientEmail
    //    );

    constructor() {
        admins[msg.sender] = true;
    }

    modifier onlyAdmins() {
        require(admins[msg.sender], "You are not an admin!");
        _;
    }

    //modyfikator onlyAdmins zakomentowany, zeby kazdy mogl to wywolac
    function addAdmin(address newAdminAddress) public // onlyAdmins
    {
        admins[newAdminAddress] = true;
    }

    function removeAdmin(address _admin) public
    {
        admins[_admin] = false;
    }


    function isAdmin(address _admin) public view returns (bool) {
        return admins[_admin];
    }

    function getSubscription(string memory subscriptionId) public view
    returns (Subscription memory result)
    {
        result = subscriptions[subscriptionId];
    }

    function addSubscription(Subscription memory subscription) public {
        subscriptionIds.push(subscription.subscriptionId);

        //        emit SuccessfullyAddedSubscription(subscription.subscriptionId, subscription.subscriptionOwner.name, subscription.subscriptionOwner.surname, subscription.subscriptionOwner.email);
    }

}
