const { ethers } = require("ethers");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// --- 1. CONFIG & ABI ---
const lottoData = require("./contractABI/lotto.json");
const CONTRACT_ABI = lottoData.abi ? lottoData.abi : lottoData;

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;

// --- 2. PROVIDER SETUP ---
const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    staticNetwork: true
});

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// --- 3. ENDPOINTS ---
app.get("/winners", (req, res) => {
    if (fs.existsSync("winners.json")) {
        const data = JSON.parse(fs.readFileSync("winners.json"));
        res.json(data);
    } else { res.json([]); }
});

app.get("/tickets", (req, res) => {
    if (fs.existsSync("tickets.json")) {
        const data = JSON.parse(fs.readFileSync("tickets.json"));
        res.json(data);
    } else { res.json([]); }
});

// --- 4. ROBUST EVENT LISTENERS ---
function setupListeners() {
    console.log("👂 Listening for blockchain events...");

    // Listen for Ticket Purchases
    contract.on("TicketPurchased", (roundId, player, numbers) => {
        try {
            const log = `[Round ${roundId}] 🎟️ Ticket: ${player} | Numbers: [${numbers.join(", ")}]`;
            console.log(log);
            saveToHistory("tickets.json", { 
                roundId: roundId.toString(), 
                player, 
                numbers: numbers.map(Number), 
                time: new Date() 
            });
        } catch (err) { console.error("Error processing TicketPurchased:", err); }
    });

    // Listen for Winning Numbers
    contract.on("WinningNumbersPick", (roundId, numbers, prizePool) => {
        try {
            const ethWon = ethers.formatEther(prizePool);
            console.log(`\n🏆 DRAW COMPLETE - ROUND ${roundId}`);
            console.log(`Numbers: [${numbers.join(", ")}] | Prize: ${ethWon} ETH\n`);
            
            saveToHistory("winners.json", { 
                roundId: roundId.toString(), 
                numbers: numbers.map(Number), 
                prize: ethWon, 
                time: new Date() 
            });
        } catch (err) { console.error("Error processing WinningNumbersPick:", err); }
    });

    // Error handler for the provider to restart listeners if they drop
    provider.on("error", (error) => {
        console.error("Provider Error! Restarting listeners in 5s...", error);
        setTimeout(() => setupListeners(), 5000);
    });
}

// --- 5. AUTOMATION LOOP ---
async function startAutomation() {
    setInterval(async () => {
        try {
            const startTime = await contract.roundStart();
            const duration = await contract.ROUND_DURATION();
            const isDrawing = await contract.drawingInProgress();
            const count = await contract.getParticipantsCount();
            
            const now = Math.floor(Date.now() / 1000);
            const deadline = Number(startTime) + Number(duration);

            // Trigger only if timer is up, not currently drawing, and has players
            if (startTime > 0 && now >= deadline && !isDrawing && count > 0) {
                console.log("⏰ Timer expired. Sending requestWinningNumbers transaction...");
                const tx = await contract.requestWinningNumbers();
                await tx.wait();
                //console.log("✅ Transaction confirmed.");
            }
        } catch (error) {
            // Reverts silently for expected logic (e.g. 0 players)
            if (!error.message.includes("No players")) {
                console.log("Automation status check...");
            }
        }
    }, 30000); // Checks every 30 seconds
}

// --- 6. START EVERYTHING ---
async function main() {
    console.log(`\n🟢 LOTTO SERVER ACTIVE`);
    console.log(`Connected to: ${CONTRACT_ADDRESS}`);
    
    setupListeners();
    startAutomation();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server live at http://localhost:${PORT}`);
        console.log(`Get winners: http://localhost:${PORT}/winners`);
        console.log(`Get tickets: http://localhost:${PORT}/tickets  \n`);
    });
}

function saveToHistory(filename, data) {
    let current = [];
    if (fs.existsSync(filename)) {
        try {
            const content = fs.readFileSync(filename, 'utf8');
            current = content ? JSON.parse(content) : [];
        } catch (e) { current = []; }
    }
    current.push(data);
    fs.writeFileSync(filename, JSON.stringify(current, null, 2));
}

main().catch((error) => {
    console.error("Fatal Server Error:", error);
    process.exit(1);
});