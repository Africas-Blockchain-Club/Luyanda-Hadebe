const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

const lottoData = require("./contractABI/lotto.json");
const CONTRACT_ABI = lottoData.abi ? lottoData.abi : lottoData;

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;

async function startServer() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  console.log(`\n🟢 LOTTO SERVER ACTIVE`);
  console.log(`Connected to: ${CONTRACT_ADDRESS}\n`);

  // --- 1. EVENT: New Ticket Purchased ---
  contract.on("TicketPurchased", (roundId, player, numbers) => {
    const log = `[Round ${roundId}] 🎟️ Ticket: ${player} | Numbers: [${numbers.join(", ")}]`;
    console.log(log);
    saveToHistory("tickets.json", { roundId: roundId.toString(), player, numbers: numbers.map(Number), time: new Date() });
  });

  // --- 2. EVENT: Draw Completed ---
  contract.on("WinningNumbersPick", (roundId, numbers, prizePool) => {
    const ethWon = ethers.formatEther(prizePool);
    console.log(`\n🏆 DRAW COMPLETE - ROUND ${roundId}`);
    console.log(`Winning Numbers: [${numbers.join(", ")}]`);
    console.log(`Total Prize Distributed: ${ethWon} ETH\n`);
    saveToHistory("winners.json", { roundId: roundId.toString(), numbers: numbers.map(Number), prize: ethWon });
  });

  // --- 3. AUTOMATION: The "Heartbeat" ---
  // Checks every 30 seconds if the 5-minute timer is up
  setInterval(async () => {
    try {
      const startTime = await contract.roundStart();
      const duration = await contract.ROUND_DURATION();
      const count = await contract.getParticipantsCount();
      
      const now = Math.floor(Date.now() / 1000);
      const deadline = Number(startTime) + Number(duration);

      if (startTime > 0 && now >= deadline && count > 0) {
        console.log("⏰ Timer expired. Triggering Draw...");
        const tx = await contract.requestWinningNumbers();
        console.log(`Sent: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Draw Request Confirmed.");
      }
    } catch (error) {
      // Reverts if someone already called it or if 0 players
      if (!error.message.includes("No players")) {
        console.error("Automation Error:", error.reason || error.message);
      }
    }
  }, 30000);
}

// Simple JSON helper to save history
function saveToHistory(filename, data) {
  let current = [];
  if (fs.existsSync(filename)) {
    current = JSON.parse(fs.readFileSync(filename));
  }
  current.push(data);
  fs.writeFileSync(filename, JSON.stringify(current, null, 2));
}

startServer();