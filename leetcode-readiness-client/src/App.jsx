import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [company, setCompany] = useState('');
  
  // Company Search States
  const [allCompanies, setAllCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Stats & UI States
  const [results, setResults] = useState('');
  const [scoreCard, setScoreCard] = useState(null);
  const [questions, setQuestions] = useState([]); 
  const [weakness, setWeakness] = useState('');
  const [dailyGoal, setDailyGoal] = useState(2);
  const [tracker, setTracker] = useState({ solvedToday: 0, streak: 0 });

  // On Load: Fetch Data & Companies
  useEffect(() => {
    if (window.chrome && chrome.storage) {
      chrome.storage.local.get(['savedUsername', 'dailyGoal'], (data) => {
        if (data.savedUsername) setUsername(data.savedUsername);
        if (data.dailyGoal) setDailyGoal(data.dailyGoal);
      });
    }

    fetch('http://localhost:5000/api/companies')
      .then(res => res.json())
      .then(data => { if (data.success) setAllCompanies(data.companies); })
      .catch(err => console.error("Failed to load companies:", err));

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Readiness Heuristic
  const calculateReadiness = (selectedCompany, easy, medium, hard) => {
    const points = (easy * 0.5) + (medium * 3) + (hard * 7);
    let targetPoints = 2000; 
    let advice = `For ${selectedCompany.toUpperCase()}, focus on core Medium patterns (Trees, Graphs, Hash Maps) and clean, bug-free execution.`;
    let penalty = 0;

    if (selectedCompany === 'google') {
      targetPoints = 3500; advice = "Google is notoriously difficult. Focus heavily on Hard level problems, Graphs, and DP.";
      if (hard < 150) { penalty = 15; advice += " ⚠️ Penalty: Need more Hard problems."; }
    } else if (selectedCompany === 'meta') {
      targetPoints = 2800; advice = "Meta requires absolute perfection and speed. Focus on bug-free Mediums.";
      if (medium < 250) { penalty = 10; advice += " ⚠️ Penalty: Increase Medium count."; }
    } else if (selectedCompany === 'amazon') {
      targetPoints = 2200; advice = "Amazon emphasizes standard Mediums (Trees/Graphs) and Leadership Principles.";
      if (medium < 150) { penalty = 10; advice += " ⚠️ Penalty: Need more Mediums."; }
    }

    let rawPercentage = Math.round((points / targetPoints) * 100);
    return { percentage: Math.max(0, Math.min(rawPercentage - penalty, 100)), advice };
  };

  const handleGoalChange = (e) => {
    const newGoal = parseInt(e.target.value) || 0;
    setDailyGoal(newGoal);
    if (window.chrome && chrome.storage) chrome.storage.local.set({ dailyGoal: newGoal });
  };

  const handleCompanySelect = (comp) => {
    setCompany(comp);
    setSearchQuery(comp.toUpperCase());
    setShowDropdown(false);
  };

  const handleCheckStats = () => {
    // 1. Sanitize the input immediately to kill trailing spaces
    const cleanUsername = username.trim();

    if (!cleanUsername || !company) {
      setResults("Please enter a username and select a target company!");
      return;
    }

    setResults(`Fetching stats for ${cleanUsername}...`);
    setScoreCard(null); setQuestions([]); setWeakness('');

    // 2. User-Specific Memory Keys
    const dateKey = `lastDate_${cleanUsername}`;
    const startKey = `startTotal_${cleanUsername}`;
    const lastKey = `lastTotal_${cleanUsername}`;
    const streakKey = `streak_${cleanUsername}`;
    const goalKey = `goalMetToday_${cleanUsername}`;

    if (window.chrome && chrome.storage) chrome.storage.local.set({ savedUsername: cleanUsername });

    if (window.chrome && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "fetchStats", username: cleanUsername }, (response) => {
        
        // --- SMART ERROR HANDLER ---
        // 1. Check for a total network failure or blocked request
        if (!response || !response.success) {
          setResults(`❌ Network Error: ${response?.error || 'Chrome blocked the request. Check manifest.json host_permissions.'}`);
          return;
        }

        // 2. Check if LeetCode's server specifically returned an API error
        if (response.data?.errors) {
          setResults(`❌ LeetCode API Error: ${response.data.errors[0].message}`);
          return;
        }

        // 3. Success state: User found!
        if (response.data?.data?.matchedUser) {
          
          const data = response.data.data.matchedUser;
          const stats = data.submitStats.acSubmissionNum;
          
          // Use optional chaining in case they have exactly 0 solves in a category
          const easy = stats.find(s => s.difficulty === "Easy")?.count || 0;
          const medium = stats.find(s => s.difficulty === "Medium")?.count || 0;
          const hard = stats.find(s => s.difficulty === "Hard")?.count || 0;
          const currentTotal = easy + medium + hard;

          setResults(`✅ Solved Data:\nEasy: ${easy} | Medium: ${medium} | Hard: ${hard}`);
          setScoreCard(calculateReadiness(company, easy, medium, hard));

          // --- Weakness Analyzer ---
          const tags = data.tagProblemCounts;
          const allTags = [...(tags.advanced || []), ...(tags.intermediate || []), ...(tags.fundamental || [])];
          const crucialTopics = ['Dynamic Programming', 'Graph', 'Tree', 'Backtracking'];
          
          let criticalWeakness = null;
          for (let tag of allTags) {
            if (crucialTopics.includes(tag.tagName) && tag.problemsSolved < 15) {
              criticalWeakness = `${tag.tagName} (Only ${tag.problemsSolved} solved)`;
              break; 
            }
          }
          if (criticalWeakness) setWeakness(criticalWeakness);

          // --- User-Specific Bulletproof Streak Tracker ---
          chrome.storage.local.get([dateKey, startKey, lastKey, streakKey, goalKey], (storage) => {
            const today = new Date();
            const todayStr = today.toDateString();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();

            let startTotal = storage[startKey] !== undefined ? storage[startKey] : currentTotal;
            let lastTotal = storage[lastKey] !== undefined ? storage[lastKey] : currentTotal;
            let streak = storage[streakKey] || 0;
            let goalMetToday = storage[goalKey] || false;

            if (storage[dateKey] !== todayStr) {
              if (storage[dateKey] === yesterdayStr) {
                if (!goalMetToday) streak = 0; 
                startTotal = lastTotal; 
              } else {
                streak = 0;
                startTotal = currentTotal; 
              }
              goalMetToday = false; 
            }

            if (currentTotal < startTotal) startTotal = currentTotal;

            const solvedToday = currentTotal - startTotal;
            if (solvedToday >= dailyGoal && !goalMetToday && dailyGoal > 0) {
              streak += 1;
              goalMetToday = true;
            }

            setTracker({ solvedToday, streak });
            
            chrome.storage.local.set({ 
              [dateKey]: todayStr, [startKey]: startTotal, [lastKey]: currentTotal, [streakKey]: streak, [goalKey]: goalMetToday 
            });
          });
          
        } else {
          // 4. Missing User State
          setResults(`❌ Error: "${cleanUsername}" was not found in LeetCode's public database.`);
        }
      });
    }

    // Fetch Backend Questions
    fetch(`http://localhost:5000/api/questions/${company}`)
      .then(res => res.json())
      .then(data => { if (data.success) setQuestions(data.questions); })
      .catch(err => console.error("Backend error:", err));
  };

  const filteredCompanies = allCompanies.filter(c => 
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      <h2>Readiness Tracker</h2>
      
      <div className="card streak-card">
        <div>
          <div className="streak-title">🔥 {tracker.streak} Day Streak</div>
          <div className="streak-subtitle">Solved Today: {tracker.solvedToday} / {dailyGoal}</div>
        </div>
        <div className="goal-input-wrapper">
          <label>Goal</label>
          <input type="number" value={dailyGoal} onChange={handleGoalChange} min="1" />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label>LeetCode Username</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g., neetcode" />
      </div>

      <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '16px' }}>
        <label>Target Company</label>
        <input 
          type="text" 
          value={searchQuery} 
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCompany(''); 
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search companies..."
        />
        
        {showDropdown && (
          <ul className="dropdown-list">
            {filteredCompanies.length > 0 ? (
              filteredCompanies.map((comp, idx) => (
                <li key={idx} className="dropdown-item" onClick={() => handleCompanySelect(comp)}>
                  {comp}
                </li>
              ))
            ) : (
              <li className="dropdown-item" style={{ color: '#94a3b8', cursor: 'default' }}>No companies found</li>
            )}
          </ul>
        )}
      </div>
      
      <button onClick={handleCheckStats}>Analyze Profile</button>
      
      {results && <div className="results-box">{results}</div>}

      {weakness && (
        <div className="alert-card">
          <span>⚠️</span>
          <span><strong>Weakness Detected:</strong> {weakness}. Focus on this immediately!</span>
        </div>
      )}

      {scoreCard && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3 style={{ margin: '0', fontSize: '1rem', color: '#0f172a', textTransform: 'capitalize' }}>
            {company} Readiness <span style={{ float: 'right', color: scoreCard.percentage > 75 ? '#10b981' : scoreCard.percentage > 40 ? '#f59e0b' : '#ef4444' }}>{scoreCard.percentage}%</span>
          </h3>
          
          <div className="score-bar-bg">
            <div className="score-bar-fill" style={{ 
              width: `${scoreCard.percentage}%`, 
              backgroundColor: scoreCard.percentage > 75 ? '#10b981' : scoreCard.percentage > 40 ? '#f59e0b' : '#ef4444' 
            }}></div>
          </div>
          
          <p style={{ margin: '0', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
            💡 <strong>Advice:</strong> {scoreCard.advice}
          </p>
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Study Questions
          </h4>
          <ul className="question-list">
            {questions.map((q, index) => (
              <li key={index} className="question-item">
                <a href={q.link} target="_blank" rel="noopener noreferrer" className="question-link">
                  {q.title}
                </a>
                <span className={`tag-difficulty ${q.difficulty === 'HARD' ? 'tag-hard' : q.difficulty === 'MEDIUM' ? 'tag-medium' : 'tag-easy'}`}>
                  {q.difficulty}
                </span>
                <span className="question-pattern">Pattern: {q.pattern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* DEV TOOL: WIPE STORAGE */}
      <div 
        onClick={() => { chrome.storage.local.clear(() => alert("Storage Wiped! Reload extension.")); }} 
        style={{ fontSize: '10px', color: '#ef4444', cursor: 'pointer', textAlign: 'center', marginTop: '20px' }}
      >
        [Dev: Reset Streak Data]
      </div>
    </div>
  );
}

export default App;