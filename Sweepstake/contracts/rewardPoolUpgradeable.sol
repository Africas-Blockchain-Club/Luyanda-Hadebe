// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import Upgradeable versions of OpenZeppelin contracts
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title EthRewardPoolUpgradeable
 * @dev This contract implements a timed reward pool using the UUPS proxy pattern.
 */
contract EthRewardPoolUpgradeable is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    // State variables (Order must never change in future upgrades!)
    uint256 public roundId;
    uint256 public roundStart;
    uint256 public roundDuration;
    uint256 public minContribution;

    address payable[] public participants;
    mapping(address => bool) public hasJoined;
    mapping(uint256 => address payable) public rewardHistory;

    event ParticipantJoined(address indexed participant, uint256 amount);
    event RewardDistributed(address indexed recipient, uint256 amount, uint256 roundId);
    event NewRoundStarted(uint256 roundId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Replaces the constructor. Can only be called once.
     */
    function initialize() public initializer {
        // Initialize inherited contracts
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        // Initialize state
        roundId = 1;
        roundStart = block.timestamp;
        roundDuration = 10 minutes;
        minContribution = 0.00001 ether;
        
        emit NewRoundStarted(roundId);
    }

    /**
     * @dev Required by UUPS to restrict who can upgrade the contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Internal logic to clear round state.
     */
    function _startNewRound() internal {
        for (uint256 i = 0; i < participants.length; i++) {
            hasJoined[participants[i]] = false;
        }
        delete participants;

        roundStart = block.timestamp;
        roundId++;

        emit NewRoundStarted(roundId);
    }

    /**
     * @dev Users join the pool. Auto-resets if the timer has expired.
     */
    function joinPool() external payable nonReentrant {
        if (block.timestamp >= roundStart + roundDuration) {
            _startNewRound();
        }

        require(!hasJoined[msg.sender], "Already joined this round");
        require(msg.value >= minContribution, "Minimum contribution not met");

        participants.push(payable(msg.sender));
        hasJoined[msg.sender] = true;

        emit ParticipantJoined(msg.sender, msg.value);
    }

    /**
     * @dev Distributes the reward to a pseudo-random winner.
     */
    function distributeReward() external nonReentrant {
        require(block.timestamp >= roundStart + roundDuration, "Round not finished");
        require(participants.length > 0, "No participants");

        uint256 index = _random() % participants.length;
        address payable winner = participants[index];

        uint256 prize = address(this).balance;
        (bool success, ) = winner.call{value: prize}("");
        require(success, "Reward transfer failed");

        rewardHistory[roundId] = winner;
        emit RewardDistributed(winner, prize, roundId);

        _startNewRound();
    }

    /**
     * @dev Pseudo-randomness logic. 
     */
    function _random() internal view returns (uint256) {
        return uint256(
            keccak256(
                abi.encodePacked(block.prevrandao, participants.length, roundId)
            )
        );
    }

    // --- Administrative Functions (New since it's upgradeable) ---

    function setMinContribution(uint256 _amount) external onlyOwner {
        minContribution = _amount;
    }

    function setRoundDuration(uint256 _duration) external onlyOwner {
        roundDuration = _duration;
    }

    // --- View Functions ---

    function getParticipants() external view returns (address payable[] memory) {
        return participants;
    }

    function getPoolBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getRewardRecipient(uint256 _roundId) external view returns (address payable) {
        return rewardHistory[_roundId];
    }
}