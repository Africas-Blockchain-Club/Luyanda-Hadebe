// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EthRewardPool is ReentrancyGuard {
    address public owner;
    uint256 public roundId;
    uint256 public roundStart;
    uint256 public constant ROUND_DURATION = 10 minutes;
    uint256 public constant MIN_CONTRIBUTION = 0.01 ether;

    address payable[] public participants;
    mapping(address => bool) public hasJoined;
    mapping(uint256 => address payable) public rewardHistory;

    event ParticipantJoined(address indexed participant, uint256 amount);
    event RewardDistributed(address indexed recipient, uint256 amount, uint256 roundId);
    event NewRoundStarted(uint256 roundId);

    constructor() {
        owner = msg.sender;
        roundId = 1;
        roundStart = block.timestamp;
        emit NewRoundStarted(roundId);
    }

    modifier roundOpen() {
        require(block.timestamp < roundStart + ROUND_DURATION, "Round closed");
        _;
    }

    function joinPool() external payable roundOpen nonReentrant {
        require(!hasJoined[msg.sender], "Already joined this round");
        require(msg.value >= MIN_CONTRIBUTION, "Minimum contribution is 0.01 ETH");

        participants.push(payable(msg.sender));
        hasJoined[msg.sender] = true;

        emit ParticipantJoined(msg.sender, msg.value);
    }

    function getParticipants() external view returns (address payable[] memory) {
        return participants;
    }

    function getPoolBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// ⚠️ Pseudo-randomness for testing/school project only
    function _random() internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.prevrandao, participants.length, roundId)));
    }

    function distributeReward() external nonReentrant {
        require(block.timestamp >= roundStart + ROUND_DURATION, "Round not finished");
        require(participants.length > 0, "No participants");

        uint256 index = _random() % participants.length;
        address payable winner = participants[index];

        uint256 prize = address(this).balance;
        (bool success, ) = winner.call{value: prize}("");
        require(success, "Reward transfer failed");

        rewardHistory[roundId] = winner;
        emit RewardDistributed(winner, prize, roundId);

        // Reset round
        for (uint256 i = 0; i < participants.length; i++) {
            hasJoined[participants[i]] = false;
        }
        delete participants;

        roundStart = block.timestamp;
        roundId++;
        emit NewRoundStarted(roundId);
    }

    function getRewardRecipient(uint256 _roundId) external view returns (address payable) {
        return rewardHistory[_roundId];
    }
}