import { useState, useEffect } from "react";
import { ethers } from "ethers";
import poolAbi from "./contracts/ethPool.json";

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [poolBalance, setPoolBalance] = useState("0");
  const [participants, setParticipants] = useState([]);
  const [lastWinner, setLastWinner] = useState(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState("");
  const [canDistribute, setCanDistribute] = useState(false);

  // Hardcoded constants (safe for frontend)
  const MIN_CONTRIBUTION = ethers.parseEther("0.00001"); // 0.00001 ETH
  const ROUND_DURATION = 10 * 60; // 10 minutes in seconds

  const CONTRACT_ADDRESS = "0x4ffAf25aC16311620f280c80c328694B4aa1f636"; // your deployed contract

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask!");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      if (network.chainId !== 11155111n) {
        alert("Please switch to Sepolia Testnet");
        return;
      }

      const pool = new ethers.Contract(CONTRACT_ADDRESS, poolAbi, signer);

      setContract(pool);
      setAccount({ address });
      await refreshData(pool);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  const refreshData = async (poolContract) => {
    try {
      const balance = await poolContract.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));

      const currentParticipants = await poolContract.getParticipants();
      setParticipants(currentParticipants);

      const currentRound = await poolContract.roundId(); // BigInt
      if (currentRound > 1n) {
        const winner = await poolContract.getRewardRecipient(currentRound - 1n);
        setLastWinner(winner);
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  };

  // Timer logic
  useEffect(() => {
    if (!contract) return;

    const updateTimer = async () => {
      try {
        // Use callStatic to safely read public variables
        let start;
        try {
          start = await contract.callStatic.roundStart();
        } catch {
          // fallback to current time if call fails
          start = BigInt(Math.floor(Date.now() / 1000));
        }

        const endTime = (Number(start) + ROUND_DURATION) * 1000;

        const interval = setInterval(() => {
          const now = Date.now();
          const distance = endTime - now;

          if (distance <= 0) {
            clearInterval(interval);
            setTimeLeft("Round Finished!");
            setCanDistribute(true);
          } else {
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            setTimeLeft(`${minutes}m ${seconds}s`);
            setCanDistribute(false);
          }
        }, 1000);

        return () => clearInterval(interval);
      } catch (err) {
        console.error("Timer error:", err);
      }
    };

    updateTimer();
  }, [contract, participants]);

  // Join pool
  const joinPool = async () => {
    if (!contract) return;

    try {
      const tx = await contract.joinPool({ value: MIN_CONTRIBUTION });
      await tx.wait();
      await refreshData(contract);
      alert(`Successfully joined the pool with ${ethers.formatEther(MIN_CONTRIBUTION)} ETH!`);
    } catch (err) {
      console.error("Join failed:", err);
      alert("Join failed. Check console for details.");
    }
  };

  // Distribute reward
  const distributeReward = async () => {
    if (!contract) return;

    try {
      const tx = await contract.distributeReward();
      await tx.wait();
      await refreshData(contract);
      alert("Reward distributed!");
    } catch (err) {
      console.error("Distribution failed:", err);
      alert("Could not distribute. Is the timer finished?");
    }
  };

  return (
  <div style={{
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
    padding: "40px 20px"
  }}>
    <div style={{
      maxWidth: "500px",
      margin: "auto",
      backgroundColor: "#1e293b",
      borderRadius: "24px",
      padding: "32px",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      border: "1px solid #334155"
    }}>
      <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "800" }}>
        Ama <span style={{ color: "#38bdf8" }}>MILLION!</span>
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: "32px", fontSize: "14px" }}>
        {account ? `Connected: ${account.address.slice(0,6)}...${account.address.slice(-4)}` : "Connect your wallet to start"}
      </p>

      {!account ? (
        <button 
          onClick={connectWallet} 
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: "#38bdf8",
            color: "#0f172a",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: "pointer",
            transition: "0.2s"
          }}
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          {/* Stats Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "24px"
          }}>
            <div style={{ background: "#334155", padding: "16px", borderRadius: "16px", textAlign: "left" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>POOL SIZE</span>
              <div style={{ fontSize: "18px", fontWeight: "bold" }}>{poolBalance} ETH</div>
            </div>
            <div style={{ background: "#334155", padding: "16px", borderRadius: "16px", textAlign: "left" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>PLAYERS</span>
              <div style={{ fontSize: "18px", fontWeight: "bold" }}>{participants.length}</div>
            </div>
          </div>

          {/* Timer Section */}
          <div style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            padding: "24px",
            borderRadius: "16px",
            border: "1px solid #38bdf8",
            marginBottom: "24px"
          }}>
            <span style={{ fontSize: "12px", color: "#38bdf8", letterSpacing: "1px" }}>TIME REMAINING</span>
            <div style={{ fontSize: "36px", fontWeight: "900", color: "#f8fafc", margin: "8px 0" }}>{timeLeft}</div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={joinPool}
              disabled={canDistribute}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: canDistribute ? "#475569" : "#38bdf8",
                color: "#0f172a",
                fontWeight: "bold",
                cursor: canDistribute ? "not-allowed" : "pointer",
                fontSize: "16px"
              }}
            >
              Join Pool (0.00001 ETH)
            </button>

            <button
              onClick={distributeReward}
              disabled={!canDistribute}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: "2px solid #22c55e",
                backgroundColor: canDistribute ? "#22c55e" : "transparent",
                color: canDistribute ? "#0f172a" : "#22c55e",
                fontWeight: "bold",
                cursor: !canDistribute ? "not-allowed" : "pointer",
                fontSize: "16px",
                opacity: !canDistribute ? 0.5 : 1
              }}
            >
              Distribute Reward
            </button>
          </div>

          {/* Last Winner Toast */}
          {lastWinner && (
            <div style={{
              marginTop: "24px",
              padding: "12px",
              background: "rgba(34, 197, 94, 0.1)",
              borderRadius: "12px",
              border: "1px solid #22c55e",
              fontSize: "13px"
            }}>
              <span style={{ color: "#22c55e" }}>🏆 Last Winner:</span> {lastWinner.slice(0,10)}...
            </div>
          )}

          {/* Participants List */}
          <div style={{ marginTop: "32px", textAlign: "left" }}>
            <h4 style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "12px" }}>Active Participants</h4>
            <div style={{ 
              maxHeight: "120px", 
              overflowY: "auto", 
              borderRadius: "12px",
              background: "#0f172a",
              padding: "8px"
            }}>
              {participants.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#475569", textAlign: "center" }}>No entries yet</p>
              ) : (
                participants.map((p, i) => (
                  <div key={i} style={{ 
                    fontSize: "11px", 
                    padding: "8px", 
                    borderBottom: "1px solid #1e293b",
                    color: "#94a3b8"
                  }}>
                    {p}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}

export default App;