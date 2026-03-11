import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import poolAbi from "./contract/lotto.json";

// --- Styled Components ---
const StatCard = ({ label, value, color }) => (
  <div style={{ 
    background: "#1e293b", padding: "24px", borderRadius: "20px", 
    borderLeft: `6px solid ${color}`, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)"
  }}>
    <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "bold", letterSpacing: "1.5px" }}>{label}</div>
    <div style={{ fontSize: "28px", fontWeight: "900", marginTop: "8px", fontFamily: "monospace" }}>{value}</div>
  </div>
);

const NumberBall = ({ num, active, onClick }) => (
  <button 
    onClick={onClick} 
    style={{
      width: "100%", aspectRatio: "1/1", borderRadius: "14px", border: "none",
      backgroundColor: active ? "#38bdf8" : "#1e293b",
      color: active ? "#0f172a" : "#94a3b8",
      fontWeight: "900", fontSize: "18px", cursor: "pointer",
      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: active ? "scale(0.92)" : "scale(1)",
      boxShadow: active ? "0 0 20px rgba(56, 189, 248, 0.5)" : "none",
      border: active ? "none" : "1px solid #334155"
    }}
  >
    {num}
  </button>
);

const ResultBall = ({ num }) => (
  <div style={{
    width: "42px", height: "42px", borderRadius: "50%",
    background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
    color: "#0f172a", fontSize: "18px", fontWeight: "900",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 10px rgba(251, 191, 36, 0.4)"
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
  const [participantsCount, setParticipantsCount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // High-performance timer states
  const [rawStartTime, setRawStartTime] = useState(0);
  const [duration, setDuration] = useState(300); // Default 5 mins
  const [displayTime, setDisplayTime] = useState("00:00");

  const CONTRACT_ADDRESS = "0xf454E5f1B578bcf48316fbF601c893f083455179";

  const connectWallet = async () => {
    if (!window.ethereum) return alert("MetaMask not found!");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const lotto = new ethers.Contract(CONTRACT_ADDRESS, poolAbi, signer);
      setContract(lotto);
      setAccount({ address: await signer.getAddress() });
      syncBlockchainData(lotto);
    } catch (err) { console.error(err); }
  };

  const syncBlockchainData = useCallback(async (lotto) => {
    try {
      const [balance, count, drawing, start, dur] = await Promise.all([
        lotto.getPoolBalance(),
        lotto.getParticipantsCount(),
        lotto.drawingInProgress(),
        lotto.roundStart(),
        lotto.ROUND_DURATION()
      ]);

      setPoolBalance(ethers.formatEther(balance));
      setParticipantsCount(Number(count));
      setIsDrawing(drawing);
      setRawStartTime(Number(start));
      setDuration(Number(dur));

      // Optimized fetching of winning numbers array from ABI mapping
      const nums = [];
      for (let i = 0; i < 7; i++) {
        try {
          const n = await lotto.winningNumbers(i);
          nums.push(Number(n));
        } catch { break; }
      }
      setWinningNumbers(nums);
    } catch (e) { console.error("Sync Error", e); }
  }, []);

  // Visual Countdown Effect (Runs every 1s, doesn't talk to blockchain)
  useEffect(() => {
    const clock = setInterval(() => {
      if (rawStartTime === 0) {
        setDisplayTime("IDLE");
        return;
      }
      const endTime = (rawStartTime + duration) * 1000;
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setDisplayTime("EXPIRED");
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setDisplayTime(`${m}:${s < 10 ? "0" + s : s}`);
      }
    }, 1000);
    return () => clearInterval(clock);
  }, [rawStartTime, duration]);

  // Blockchain Sync Effect (Runs every 15s)
  useEffect(() => {
    if (contract) {
      const sync = setInterval(() => syncBlockchainData(contract), 15000);
      return () => clearInterval(sync);
    }
  }, [contract, syncBlockchainData]);

  const handleBuy = async () => {
    if (selectedNumbers.length !== 7) return alert("Select 7!");
    try {
      // Sort numbers before sending to match contract's ascending logic
      const sorted = [...selectedNumbers].sort((a, b) => a - b);
      const tx = await contract.buyTicket(sorted, { value: ethers.parseEther("0.001") });
      await tx.wait();
      syncBlockchainData(contract);
      setSelectedNumbers([]);
    } catch (err) { alert("Tx Failed"); }
  };

  const triggerDraw = async () => {
    try {
      const tx = await contract.requestWinningNumbers();
      await tx.wait();
      syncBlockchainData(contract);
    } catch (err) { alert(err.reason || "Draw criteria not met"); }
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100vw", backgroundColor: "#020617", 
      color: "#f8fafc", margin: 0, padding: 0, overflowX: "hidden"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 20px" }}>
        
        {/* Fullscreen Header */}
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <h1 style={{ fontSize: "64px", fontWeight: "900", letterSpacing: "-3px", margin: 0 }}>
            AMAMILLION<span style={{ color: "#38bdf8" }}>X</span>
          </h1>
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "10px" }}>
             <span style={{ color: "#64748b", fontWeight: "bold" }}>BLOCKCHAIN LOTTERY</span>
             <span style={{ color: "#38bdf8" }}>•</span>
             <span style={{ color: "#64748b", fontWeight: "bold" }}>WIN BIG!!</span>
          </div>
        </div>

        {!account ? (
          <div style={{ height: "400px", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b", borderRadius: "40px" }}>
             <button onClick={connectWallet} style={{
               padding: "24px 48px", fontSize: "20px", fontWeight: "900", borderRadius: "20px", background: "#38bdf8", cursor: "pointer", border: "none"
             }}>CONNECT WALLET</button>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "25px", marginBottom: "40px" }}>
              <StatCard label="POOL PRIZE" value={`${poolBalance} ETH`} color="#38bdf8" />
              <StatCard label="COUNTDOWN" value={isDrawing ? "DRAWING..." : displayTime} color="#f43f5e" />
              <StatCard label="PARTICIPANTS" value={participantsCount} color="#fbbf24" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "40px" }}>
              {/* Terminal */}
              <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "40px", borderRadius: "40px", border: "1px solid #334155" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px" }}>
                  {[...Array(49)].map((_, i) => (
                    <NumberBall key={i} num={i+1} active={selectedNumbers.includes(i+1)} onClick={() => {
                      if (selectedNumbers.includes(i+1)) setSelectedNumbers(selectedNumbers.filter(n => n !== i+1));
                      else if (selectedNumbers.length < 7) setSelectedNumbers([...selectedNumbers, i+1]);
                    }} />
                  ))}
                </div>
                <button onClick={handleBuy} disabled={selectedNumbers.length < 7 || isDrawing} style={{
                  width: "100%", height: "70px", marginTop: "30px", borderRadius: "20px", border: "none", 
                  background: selectedNumbers.length === 7 ? "linear-gradient(90deg, #38bdf8, #818cf8)" : "#334155",
                  color: "#0f172a", fontSize: "20px", fontWeight: "900", cursor: "pointer"
                }}>
                  {isDrawing ? "PENDING DRAW..." : `BUY TICKET (0.001 ETH)`}
                </button>
              </div>

              {/* Sidebar */}
              <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
                <div style={{ background: "#1e293b", padding: "40px", borderRadius: "40px" }}>
                  <h3 style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 20px 0" }}>WINNING NUMBERS</h3>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    {winningNumbers.map((n, i) => <ResultBall key={i} num={n} />)}
                  </div>
                </div>

                <div style={{ padding: "40px", borderRadius: "40px", border: "2px dashed #334155", textAlign: "center" }}>
                   <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "20px" }}>Round is recurring every 5 minutes.</p>
                   <button onClick={triggerDraw} style={{
                     width: "100%", padding: "15px", borderRadius: "15px", border: "1px solid #f43f5e", 
                     background: "transparent", color: "#f43f5e", fontWeight: "900", cursor: "pointer"
                   }}>REQUEST DRAW</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;