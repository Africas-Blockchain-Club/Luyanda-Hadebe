import { useState, useEffect } from "react";
import { ethers } from "ethers";
import poolAbi from "./contract/lotto.json";

// Helper Components for a "Cool" Look
const StatCard = ({ label, value, color }) => (
  <div style={{ 
    background: "#1e293b", 
    padding: "20px", 
    borderRadius: "20px", 
    borderLeft: `5px solid ${color}`,
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
  }}>
    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "bold", letterSpacing: "1px" }}>{label}</div>
    <div style={{ fontSize: "24px", fontWeight: "900", marginTop: "5px" }}>{value}</div>
  </div>
);

const NumberBall = ({ num, active, onClick }) => (
  <button 
    onClick={onClick} 
    style={{
      width: "100%",
      aspectRatio: "1/1",
      borderRadius: "12px",
      border: "none",
      backgroundColor: active ? "#38bdf8" : "#334155",
      color: active ? "#0f172a" : "#f8fafc",
      fontWeight: "bold",
      fontSize: "16px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      transform: active ? "scale(0.95)" : "scale(1)",
      boxShadow: active ? "0 0 15px #38bdf8" : "none"
    }}
  >
    {num}
  </button>
);

const ResultBall = ({ num }) => (
  <div style={{
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#fbbf24",
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 10px rgba(251, 191, 36, 0.5)"
  }}>
    {num}
  </div>
);

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [poolBalance, setPoolBalance] = useState("0");
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [winningNumbers, setWinningNumbers] = useState([]);
  const [timeLeft, setTimeLeft] = useState("NOT STARTED");
  const [participantsCount, setParticipantsCount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);

  const CONTRACT_ADDRESS = "0xFAF5602B9A2feC3505F1C5A90F68963D347Bed5C";

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask!");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, poolAbi, signer);
      
      setContract(lotto);
      setAccount({ address: await signer.getAddress() });
      refreshData(lotto);
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  const refreshData = async (lotto) => {
    try {
      const balance = await lotto.getPoolBalance();
      setPoolBalance(ethers.formatEther(balance));
      
      const count = await lotto.getParticipantsCount();
      setParticipantsCount(Number(count));

      const drawing = await lotto.drawingInProgress();
      setIsDrawing(drawing);

      const start = await lotto.roundStart();
      const duration = await lotto.ROUND_DURATION();
      
      // Timer Logic
      if (Number(start) === 0) {
        setTimeLeft("READY TO START");
      } else {
        const endTime = (Number(start) + Number(duration)) * 1000;
        const diff = endTime - Date.now();
        if (diff <= 0) setTimeLeft("TIME EXPIRED");
        else setTimeLeft(calculateTimeLeft(endTime));
      }

      // Winning Numbers
      const nums = [];
      for (let i = 0; i < 7; i++) {
        const n = await lotto.winningNumbers(i);
        nums.push(Number(n));
      }
      setWinningNumbers(nums);
    } catch (e) {
      console.error("Data refresh failed:", e);
    }
  };

  const calculateTimeLeft = (endTime) => {
    const diff = endTime - Date.now();
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  // Interval to update timer locally every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (contract) refreshData(contract);
    }, 5000); // Check contract state every 5 seconds
    return () => clearInterval(timer);
  }, [contract]);

  const handleSelect = (n) => {
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(selectedNumbers.filter(x => x !== n));
    } else if (selectedNumbers.length < 7) {
      setSelectedNumbers([...selectedNumbers, n]);
    }
  };

  const buyTicket = async () => {
    if (selectedNumbers.length !== 7) return alert("Select exactly 7 numbers!");
    try {
      const tx = await contract.buyTicket(selectedNumbers, {
        value: ethers.parseEther("0.001"),
        gasLimit: 400000
      });
      await tx.wait();
      setSelectedNumbers([]);
      refreshData(contract);
      alert("Ticket Purchased Successfully!");
    } catch (err) {
      console.error(err);
      alert("Purchase failed. Check console.");
    }
  };

  const requestDraw = async () => {
    try {
    // 1. Simulate the call to find the revert reason
      await contract.requestWinningNumbers.staticCall();
    
    // 2. If simulation passes, execute
      const tx = await contract.requestWinningNumbers({
        gasLimit: 500000 
      });
      await tx.wait();
      alert("Request successful!");
    } catch (err) {
      console.error("Detailed Error:", err);
    
    // Attempt to extract the reason string (e.g., "Round still active")
      if (err.reason) {
        alert("Contract says: " + err.reason);
      } else if (err.data) {
      // Decode custom errors if applicable
        alert("Reverted with data: " + err.data);
      } else {
        alert("Reverted. Check: 1. Is there a player? 2. Is it the owner's wallet?");
      }
    }
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#020617", color: "#f8fafc",
      fontFamily: "'Inter', sans-serif", padding: "40px 20px"
    }}>
      <div style={{ maxWidth: "1000px", margin: "auto" }}>
        
        {/* Header Section */}
        <div style={{ textAlign: "center", marginBottom: "50px" }}>
          <h1 style={{ fontSize: "48px", fontWeight: "900", margin: 0, letterSpacing: "-2px" }}>
            Lotto<span style={{ color: "#38bdf8" }}>Chain</span>
          </h1>
          <p style={{ color: "#94a3b8", fontWeight: "500" }}>Sequential 7-Ball Crypto Lottery</p>
        </div>

        {/* Top Header Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "40px" }}>
          <StatCard label="CURRENT JACKPOT" value={`${poolBalance} ETH`} color="#38bdf8" />
          <StatCard label="ROUND TIMER" value={isDrawing ? "DRAWING..." : timeLeft} color="#f43f5e" />
          <StatCard label="TOTAL ENTRIES" value={participantsCount} color="#fbbf24" />
        </div>

        {!account ? (
          <div style={{ textAlign: "center", padding: "100px", background: "#1e293b", borderRadius: "30px" }}>
            <button 
              onClick={connectWallet} 
              style={{
                padding: "20px 40px", fontSize: "18px", fontWeight: "bold",
                background: "#38bdf8", border: "none", borderRadius: "15px", cursor: "pointer"
              }}
            >
              Connect MetaMask
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "30px" }}>
            
            {/* Number Selector Terminal */}
            <div style={{
              background: "rgba(30, 41, 59, 0.4)", borderRadius: "30px", padding: "40px",
              border: "1px solid #334155", backdropFilter: "blur(10px)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>SELECT YOUR TICKET</h3>
                <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{selectedNumbers.length} / 7</span>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "12px" }}>
                {[...Array(49)].map((_, i) => (
                  <NumberBall 
                    key={i+1} num={i+1} 
                    active={selectedNumbers.includes(i+1)} 
                    onClick={() => handleSelect(i+1)} 
                  />
                ))}
              </div>
              
              <button 
                onClick={buyTicket}
                disabled={selectedNumbers.length < 7 || isDrawing}
                style={{
                  width: "100%", marginTop: "40px", padding: "20px", borderRadius: "16px",
                  background: selectedNumbers.length === 7 ? "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)" : "#334155",
                  color: "#0f172a", fontWeight: "900", border: "none", cursor: "pointer",
                  fontSize: "18px", transition: "0.3s"
                }}
              >
                {isDrawing ? "DRAW IN PROGRESS" : "BUY TICKET (0.001 ETH)"}
              </button>
            </div>

            {/* Side Column: Winning Numbers & Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
              
              <div style={{ background: "#1e293b", padding: "30px", borderRadius: "30px", border: "1px solid #334155" }}>
                <h4 style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#94a3b8", letterSpacing: "1px" }}>LATEST DRAW RESULT</h4>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {winningNumbers.some(n => n !== 0) ? (
                    winningNumbers.map((n, i) => <ResultBall key={i} num={n} />)
                  ) : (
                    <p style={{ color: "#475569", fontSize: "14px" }}>No draw recorded yet</p>
                  )}
                </div>
              </div>

              {/* Admin Panel (Trigger for Drawing) */}
              <div style={{ padding: "30px", borderRadius: "30px", border: "2px dashed #334155" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "13px" }}>MANAGEMENT</h4>
                <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "20px" }}>
                  Anyone can request a draw once the 10-minute timer expires.
                </p>
                <button 
                  onClick={requestDraw}
                  style={{
                    width: "100%", padding: "12px", borderRadius: "10px",
                    background: "transparent", border: "1px solid #f43f5e",
                    color: "#f43f5e", fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  Request Winner Draw
                </button>
              </div>

              <div style={{ padding: "20px", color: "#94a3b8", fontSize: "12px" }}>
                 <strong>Prize Tiers (Sequential):</strong><br/>
                 - 7 Matches: 30% Pool<br/>
                 - 5-6 Matches: 20% Pool<br/>
                 - 4 Matches: 15% Pool
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;