import React, { useState, useEffect } from 'react';
// import { MOCK_DATA } from './mockData'; // Mock data no longer used

// --- CONFIGURATION ---
// const DEADLINE = new Date('2026-01-26T09:00:00'); // Real Deadline
// const DEADLINE = new Date('2025-01-01T09:00:00'); // Removed hardcoded deadline

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxLZN2R3fG5AeckUyOWQZtg3quAbADAFb3YnlrcvMINqTs0HLZjxMNMmloIrr4SHhVzSA/exec';

// Williams F1 Inspired Colors
const THEME = {
  bg: 'bg-[#001026]', // Deep Navy
  card: 'bg-[#0B1E38]',
  komatsu: {
    primary: 'border-[#0090DA]', // Electric Blue
    bg: 'bg-[#0090DA]/10',
    text: 'text-[#0090DA]',
    button: 'bg-[#0090DA] hover:bg-[#34B6F3]'
  },
  partner: {
    primary: 'border-[#00D060]', // Neon Green
    bg: 'bg-[#00D060]/10',
    text: 'text-[#00D060]',
    button: 'bg-[#00D060] hover:bg-[#40F080]'
  }
};

function App() {
  const [view, setView] = useState('TOP'); // 'TOP' | 'SUMMARY'
  const [users, setUsers] = useState([]);
  const [globalConfig, setGlobalConfig] = useState({}); // Store dice values
  const [loading, setLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Data State
  const [targetTime, setTargetTime] = useState('');
  const [resultTime, setResultTime] = useState('');

  // UI State
  const [showFinalAnswerModal, setShowFinalAnswerModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Admin / Dice State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [diceMinus, setDiceMinus] = useState('');
  const [dicePlus, setDicePlus] = useState('');
  // Removed adminDeadline (Result Deadline), as we just use target_deadline to switch modes.
  const [adminTargetDeadline, setAdminTargetDeadline] = useState('');

  // Rules Modal
  const [showRulesModal, setShowRulesModal] = useState(false);

  // User PIN State
  const [pinInput, setPinInput] = useState('');

  // Fetch Data on Mount
  useEffect(() => {
    fetch(GAS_API_URL)
      .then(res => res.json())
      .then(data => {
        // Handle new response structure { users: [], config: {} }
        if (data.users && data.config) {
          setUsers(data.users);
          setGlobalConfig(data.config);
        } else {
          // Fallback for old response locally or if GAS not updated yet
          setUsers(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch Error:", err);
        alert("データの読み込みに失敗しました");
        setLoading(false);
      });
  }, []);

  const komatsuUsers = users.filter(u => u.category === 'k');
  const partnerUsers = users.filter(u => u.category === 'm');

  const isTargetExpired = new Date() > new Date(globalConfig.target_deadline || '2026-01-25T10:59:00');

  // Logic simplified: Result Input mode starts immediately after Target Deadline passes.
  const isExpired = isTargetExpired;



  // --- HANDLERS ---

  const handleAdminSave = () => {
    if (adminPin !== '2026') { // Simple admin PIN
      alert('パスワードが違います');
      return;
    }

    // Save to GAS
    fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({
        type: 'config',
        dice_minus: diceMinus,
        dice_plus: dicePlus,
        target_deadline: adminTargetDeadline
      })
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          alert('設定を保存しました');
          setGlobalConfig({
            dice_minus: diceMinus,
            dice_plus: dicePlus,
            target_deadline: adminTargetDeadline
          });
          setShowAdminModal(false);
        } else {
          alert('保存エラー: ' + result.message);
        }
      })
      .catch(err => alert('通信エラー'));
  };

  const handleSelectUser = (participant) => {
    if (!participant) return;
    openDetail(participant);
  };

  const openDetail = (participant) => {
    setSelectedParticipant(participant);
    // Initialize Target
    setTargetTime(participant.target_2026 || '60');
    setResultTime(participant.result_2026 || '');
    setIsLocked(!!participant.locked); // Use real locked status
  };

  const handleCloseDetail = () => {
    setSelectedParticipant(null);
    setTargetTime('');
    setResultTime('');
    setPinInput('');
    setShowFinalAnswerModal(false);
    setSuccessMessage(null);
  };

  const handleCloseSuccess = () => {
    setSuccessMessage(null);
    handleCloseDetail();
  };

  const handleSaveClick = () => {
    // Validation
    const isRetire = resultTime === 'リタイア';

    // Result Mode Validation
    if (isTargetExpired) {
      if (!isRetire && (!resultTime || isNaN(parseFloat(resultTime)))) {
        alert("結果タイムを入力してください");
        return;
      }
    }
    // Target Mode Validation
    else {
      if (!targetTime || isNaN(parseFloat(targetTime))) {
        alert("目標タイムを入力してください");
        return;
      }

      // PIN Validation
      if (!pinInput || pinInput.length !== 4) {
        alert("4桁の暗証番号を入力してください");
        return;
      }

      if (selectedParticipant.pin) {
        // Verify existing PIN
        if (String(selectedParticipant.pin) !== String(pinInput)) {
          alert("暗証番号が違います");
          return;
        }
      }
    }

    setShowFinalAnswerModal(true);
  };

  const handleFinalConfirm = () => {
    setIsSaving(true);

    const payload = {
      id: selectedParticipant.id,
      // Send target/locked OR result depending on expiry
      ...(isTargetExpired
        ? { result_2026: resultTime }
        : { target_2026: targetTime, locked: true, pin: pinInput }
      )
    };

    // Use mode: 'no-cors' for GAS simple triggers if needed, but 'cors' is better if GAS returns headers.
    // Try standard CORS first since we set textOutput.
    fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(response => response.json())
      .then(result => {
        if (result.status === 'success') {
          const msg = isTargetExpired
            ? `${selectedParticipant.name}さんの結果を保存しました`
            : "目標受け付けました！パスワードを忘れないでね！";

          // Update local state to reflect changes immediately
          setUsers(prev => prev.map(u => {
            if (u.id === payload.id) {
              return { ...u, ...payload };
            }
            return u;
          }));

          setIsLocked(true);
          setShowFinalAnswerModal(false);
          setSuccessMessage(msg); // Show success modal instead of alert
          // handleCloseDetail(); // Wait for user to click OK in success modal
        } else {
          alert('保存エラー: ' + result.message);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('通信エラーが発生しました。保存できていない可能性があります。');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  // Column I (temp_2026) is the source of truth. Empty = Participating.
  // We also accept '参加' or 'フル' just in case.
  const isParticipating = !selectedParticipant?.temp_2026 || selectedParticipant?.temp_2026 === '参加' || selectedParticipant?.temp_2026 === 'フル';


  // --- SUMMARY SORTING STATE ---
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig({ key: 'id', direction: 'asc' });
      return;
    }
    setSortConfig({ key, direction });
  };

  const getEnthusiasmIcon = (u) => {
    if (!u.average || !u.target_2026) return null;
    const avg = parseFloat(u.average);
    const target = parseFloat(u.target_2026);
    if (isNaN(target)) return null;

    const diff = avg - target;

    // Using simple text for now to match the "Design" request, but icons are fine
    if (diff >= 10) return <span title="超本気！">🔥🔥🔥</span>;
    if (diff >= 0) return <span title="やる気あり！">🔥</span>;
    return (
      <span title="安全第一" className="inline-flex items-center justify-center">
        <img src="/safety-first.png" alt="安全第一" className="w-6 h-6 object-contain" />
      </span>
    );
  };

  // Charity Calculation Helper
  const calculateCharity = (u) => {
    // Retire = Max Penalty (5000)
    if (u.result_2026 === 'リタイア') return 5000;

    if (!u.result_2026 || !u.target_2026) return null;
    const result = parseFloat(u.result_2026);
    const target = parseFloat(u.target_2026);
    const dMinus = parseFloat(globalConfig.dice_minus) || 0;
    const dPlus = parseFloat(globalConfig.dice_plus) || 0;

    // Formula: (Result - Dice1 + Dice2) - Target
    const adjustedResult = result - dMinus + dPlus;
    const diff = adjustedResult - target;

    // "1 min = 500 JPY" (Plus and Minus both count). Cap at 5000.
    const amount = Math.ceil(Math.abs(diff)) * 500;
    return Math.min(amount, 5000);
  };

  // Calculate Total Charity (Active when Result Input is possible)
  const totalCharitySum = users.reduce((sum, u) => {
    // Check participation first
    if (u.temp_2026 && u.temp_2026 !== '参加' && u.temp_2026 !== 'フル') return sum;
    const c = calculateCharity(u);
    return sum + (c || 0);
  }, 0);

  const sortedData = [...users].sort((a, b) => { // Use 'users' instead of MOCK_DATA
    const key = sortConfig.key || 'id';
    const valA = key === 'average' ? (parseFloat(a.average) || 9999)
      : key === 'target_2026' ? (parseFloat(a.target_2026) || 9999)
        : a[key];
    const valB = key === 'average' ? (parseFloat(b.average) || 9999)
      : key === 'target_2026' ? (parseFloat(b.target_2026) || 9999)
        : b[key];

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <span className="text-gray-600 ml-1">⇅</span>;
    return sortConfig.direction === 'asc' ? <span className="text-blue-400 ml-1">↑</span> : <span className="text-blue-400 ml-1">↓</span>;
  };


  // --- RENDERERS ---

  if (loading) {
    return (
      <div className={`min-h-screen ${THEME.bg} flex items-center justify-center text-white`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-bold tracking-widest animate-pulse">LOADING DATA...</p>
        </div>
      </div>
    );
  }

  if (view === 'ENTHUSIASM' || view === 'RESULT') {
    // Filter out non-participants/no-entry for the list
    const filteredUsers = sortedData.filter(u => {
      // Logic: Must be Participating.
      // Reuse the logic: !temp_2026 OR '参加' OR 'フル'
      return !u.temp_2026 || u.temp_2026 === '参加' || u.temp_2026 === 'フル';
    });

    const totalCharitySum = filteredUsers.reduce((sum, u) => {
      const c = calculateCharity(u);
      return sum + (c || 0);
    }, 0);

    return (
      <div className={`min-h-screen ${THEME.bg} text-white p-4 font-sans`}>
        <div className="max-w-6xl mx-auto bg-[#0B1E38] rounded-3xl shadow-2xl overflow-hidden border border-blue-900/30">
          <div className="bg-[#051426] p-6 flex flex-col md:flex-row justify-between items-center sticky top-0 z-10 border-b border-blue-900/50 gap-4">
            <div>
              <h2 className="text-2xl font-black italic tracking-wider text-white">
                <span className="text-[#0090DA]">WILLIAMS</span> RACING STYLE
              </h2>
              <p className="text-sm text-gray-400 font-bold">PARTICIPANT LIST // 2026</p>

              {/* Dice Display for everyone */}
              {(globalConfig.dice_minus || globalConfig.dice_plus) && (
                <div className="mt-2 flex gap-4 text-xs font-mono bg-white/5 p-2 rounded inline-flex">
                  <span className="text-red-400">DICE1: -{globalConfig.dice_minus || 0}</span>
                  <span className="text-green-400">DICE2: +{globalConfig.dice_plus || 0}</span>
                  <span className="text-blue-300 border-l border-gray-600 pl-4 ml-2">
                    TOTAL: {(parseInt(globalConfig.dice_plus || 0) - parseInt(globalConfig.dice_minus || 0)) > 0 ? '+' : ''}
                    {parseInt(globalConfig.dice_plus || 0) - parseInt(globalConfig.dice_minus || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* TOTAL CHARITY DISPLAY - Only in Result View */}
            {view === 'RESULT' && (
              <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-500/10 border border-yellow-500/30 px-6 py-2 rounded-xl text-center">
                <p className="text-[10px] text-yellow-500 uppercase tracking-widest font-bold">TOTAL CHARITY</p>
                <p className="text-3xl font-black text-yellow-400 font-mono">¥{totalCharitySum.toLocaleString()}</p>
              </div>
            )}

            <button onClick={() => setView('TOP')} className="bg-[#0090DA] hover:bg-[#34B6F3] text-white px-6 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-blue-900/50">
              BACK TO TOP
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-blue-300 uppercase bg-[#08182E] border-b border-blue-900 cursor-pointer select-none">
                <tr>
                  <th className="px-2 py-4 w-12" onClick={() => handleSort('id')}>No.<SortIcon column="id" /></th>
                  <th className="px-2 py-4" onClick={() => handleSort('name')}>Name<SortIcon column="name" /></th>
                  <th className={`px-2 py-4 text-center ${view === 'RESULT' ? 'w-16' : 'w-28'}`} onClick={() => handleSort('category')}>Team<SortIcon column="category" /></th>
                  {view !== 'RESULT' && (
                    <>
                      <th className="px-2 py-4 w-20 text-center" onClick={() => handleSort('average')}>Avg<SortIcon column="average" /></th>
                      <th className="px-2 py-4 text-center" onClick={() => handleSort('target_2026')}>Target<SortIcon column="target_2026" /></th>
                    </>
                  )}
                  {view === 'RESULT' && (
                    <>
                      <th className="px-2 py-4 text-center" onClick={() => handleSort('target_2026')}>Target<SortIcon column="target_2026" /></th>
                      <th className="px-2 py-4 text-center text-lg">Result</th>
                      <th className="px-2 py-4 text-center font-mono text-gray-400 text-xs">Mix</th>
                      <th className="px-2 py-4 text-center">Charity</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-900/30 text-gray-300">
                {filteredUsers.map((u) => {
                  const charity = calculateCharity(u);
                  const icon = getEnthusiasmIcon(u);

                  // Calculate Adjusted Time for display
                  let adjustedTime = '-';
                  if (u.result_2026 && u.result_2026 !== 'リタイア') {
                    const res = parseFloat(u.result_2026);
                    const dm = parseFloat(globalConfig.dice_minus) || 0;
                    const dp = parseFloat(globalConfig.dice_plus) || 0;
                    adjustedTime = res - dm + dp;
                  } else if (u.result_2026 === 'リタイア') {
                    adjustedTime = 'DNF';
                  }

                  return (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-2 py-4 font-mono text-blue-500 font-bold">{String(u.id).padStart(2, '0')}</td>
                      <td className="px-2 py-4 font-bold text-white text-sm truncate max-w-[120px]">
                        {u.name}
                        {u.temp_2026 && <span className="ml-1 text-[10px] text-gray-500 border border-gray-600 px-1 rounded block w-fit mt-1">({u.temp_2026})</span>}
                      </td>
                      <td className="px-2 py-4 text-center">
                        {u.category === 'k' ? (
                          <span className={`px-2 py-1 rounded text-[9px] font-black bg-[#0090DA] text-white tracking-wider block whitespace-nowrap overflow-hidden text-ellipsis ${view === 'RESULT' ? 'max-w-[4rem]' : ''}`}>
                            {view === 'RESULT' ? 'K' : 'KOMATSU'}
                          </span>
                        ) : (
                          <span className={`px-2 py-1 rounded text-[9px] font-black bg-[#00D060] text-[#002010] tracking-wider block whitespace-nowrap overflow-hidden text-ellipsis ${view === 'RESULT' ? 'max-w-[4rem]' : ''}`}>
                            {view === 'RESULT' ? 'P' : 'PARTNER'}
                          </span>
                        )}
                      </td>
                      {view !== 'RESULT' && (
                        <>
                          <td className="px-2 py-4 text-center font-mono text-gray-400">
                            {(u.average && !isNaN(parseFloat(u.average))) ? parseFloat(u.average).toFixed(1) : '-'}
                          </td>
                          <td className="px-2 py-4 text-center font-bold text-[#0090DA] text-xl font-mono">
                            <div className="flex items-center justify-center gap-2">
                              {u.target_2026 || '-'}
                              {icon && <span className="scale-125">{icon}</span>}
                            </div>
                          </td>
                        </>
                      )}
                      {view === 'RESULT' && (
                        <>
                          <td className="px-2 py-4 text-center font-bold text-[#0090DA] text-lg font-mono">
                            {u.target_2026 || '-'}
                          </td>
                          <td className="px-2 py-4 text-center font-mono text-xl text-white font-black bg-white/5 rounded">
                            {u.result_2026 || '-'}
                          </td>
                          <td className="px-2 py-4 text-center font-mono text-lg text-gray-400">
                            {adjustedTime}
                          </td>
                          <td className="px-2 py-4 text-center">
                            {charity !== null ? (
                              <span className="text-yellow-400 font-bold font-mono text-sm">¥{charity.toLocaleString()}</span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${THEME.bg} flex flex-col items-center py-12 px-4 font-sans text-white overflow-y-auto`}>

      {/* HEADER */}
      <header className="mb-6 w-full max-w-lg text-center relative">
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-500/20 blur-[100px] rounded-full -z-10"></div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-2 italic">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-400">君よ、勝田の風になれ！</span>
        </h1>
        {/* Button moved to subtitle area */}

        <div className="flex justify-between items-center text-xs md:text-sm font-bold text-[#0090DA] uppercase tracking-[0.2em] border-y border-[#0090DA]/30 py-2 mx-4 mt-4 bg-black/20 backdrop-blur-sm px-4 relative">
          <div className="flex gap-2 md:gap-4 text-left">
            <span>KOMATSU</span>
            <span>PRESENCE</span>
            <span>BOOST</span>
            <span>CLUB</span>
          </div>
          <div className="flex items-center gap-1 opacity-80 shrink-0 ml-4">
            {/* Rules Button Moved Here */}
            <button
              onClick={() => setShowRulesModal(true)}
              className="text-[10px] text-blue-300 border border-blue-300/30 px-2 py-1 rounded-full hover:bg-blue-300/10 transition-colors whitespace-nowrap mr-2"
            >
              使い方・ルール
            </button>
          </div>
        </div>

        {/* TOP SCREEN DICE DISPLAY: ROW LAYOUT (Hidden until Target Deadline passes) */}
        {(isTargetExpired && (globalConfig.dice_minus || globalConfig.dice_plus)) && (
          <div className="mt-6 mx-2 flex justify-center items-stretch gap-2 md:gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
            {/* Harada -> 1st Dice */}
            <div className="bg-gradient-to-br from-red-900/40 to-red-600/10 border border-red-500/30 px-4 py-4 rounded-xl text-center shadow-[0_0_30px_rgba(220,38,38,0.2)] flex-1">
              <p className="text-[10px] text-red-300 uppercase tracking-widest mb-2 font-bold whitespace-nowrap">1st Dice(-)</p>
              <p className="text-4xl md:text-5xl font-black text-white font-mono leading-none tracking-tighter">-{globalConfig.dice_minus || 0}</p>
            </div>

            {/* Yanagisawa -> Final Dice */}
            <div className="bg-gradient-to-br from-green-900/40 to-green-600/10 border border-green-500/30 px-4 py-4 rounded-xl text-center shadow-[0_0_30px_rgba(34,197,94,0.2)] flex-1">
              <p className="text-[10px] text-green-300 uppercase tracking-widest mb-2 font-bold whitespace-nowrap">Final Dice(+)</p>
              <p className="text-4xl md:text-5xl font-black text-white font-mono leading-none tracking-tighter">+{globalConfig.dice_plus || 0}</p>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-600/10 border border-blue-500/30 px-4 py-4 rounded-xl text-center shadow-[0_0_30px_rgba(59,130,246,0.3)] flex-1 flex flex-col justify-center">
              <p className="text-[10px] text-blue-300 uppercase tracking-widest mb-1 font-bold whitespace-nowrap">TOTAL</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl md:text-5xl font-black text-white font-mono leading-none tracking-tighter">
                  {(parseInt(globalConfig.dice_plus || 0) - parseInt(globalConfig.dice_minus || 0)) > 0 ? '+' : ''}
                  {parseInt(globalConfig.dice_plus || 0) - parseInt(globalConfig.dice_minus || 0)}
                </span>
                <span className="text-xs text-blue-300 font-bold">MIN</span>
              </div>
            </div>
          </div>
        )}

        {/* TOTAL CHARITY DISPLAY (Only visible after Target Deadline matches Result Input Start) */}
        {isTargetExpired && (
          <div className="mt-6 mx-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="bg-gradient-to-r from-yellow-600/30 via-yellow-500/20 to-yellow-600/30 border border-yellow-500/50 p-4 rounded-2xl text-center shadow-[0_0_40px_rgba(234,179,8,0.2)]">
              <p className="text-yellow-500 text-xs uppercase tracking-[0.3em] font-bold mb-1">TOTAL CHARITY</p>
              <p className="text-5xl md:text-6xl font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                ¥{totalCharitySum.toLocaleString()}
              </p>
              <p className="text-[10px] text-yellow-500/70 mt-2 uppercase tracking-widest">CURRENT POOL</p>
            </div>
          </div>
        )}
      </header>

      <div className="w-full max-w-lg space-y-8 mb-8 relative z-0">

        {/* SELECTION AREA */}
        <div className="space-y-6">
          {/* Komatsu Selection */}
          <div className="bg-[#0B1E38] p-1 rounded-xl shadow-[0_0_20px_rgba(0,144,218,0.15)] border border-[#0090DA]/50 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#0090DA]"></div>
            <div className="p-6">
              <label className="block text-[#0090DA] font-black mb-3 text-xl italic flex items-center justify-between">
                KOMATSU MEMBERS
                <svg className="w-5 h-5 text-[#0090DA] opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" /></svg>
              </label>
              <select
                className="w-full p-4 bg-[#051426] border border-blue-900 rounded-lg text-white font-bold text-lg focus:ring-2 focus:ring-[#0090DA] focus:border-transparent outline-none appearance-none cursor-pointer hover:bg-[#08182E] transition-colors"
                onChange={(e) => {
                  const u = komatsuUsers.find(k => k.id === parseInt(e.target.value));
                  handleSelectUser(u);
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>名前を選択してください ▼</option>
                {komatsuUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Partner Selection */}
          <div className="bg-[#0B1E38] p-1 rounded-xl shadow-[0_0_20px_rgba(0,208,96,0.15)] border border-[#00D060]/50 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00D060]"></div>
            <div className="p-6">
              <label className="block text-[#00D060] font-black mb-3 text-xl italic flex items-center justify-between">
                PARTNER MEMBERS
                <svg className="w-5 h-5 text-[#00D060] opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
              </label>
              <select
                className="w-full p-4 bg-[#051426] border border-green-900 rounded-lg text-white font-bold text-lg focus:ring-2 focus:ring-[#00D060] focus:border-transparent outline-none appearance-none cursor-pointer hover:bg-[#08182E] transition-colors"
                onChange={(e) => {
                  const u = partnerUsers.find(p => p.id === parseInt(e.target.value));
                  handleSelectUser(u);
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>名前を選択してください ▼</option>
                {partnerUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* SUMMARY LARGE BUTTONS */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-lg mb-8">
        <button
          onClick={() => setView('ENTHUSIASM')}
          className="group relative overflow-hidden bg-gradient-to-br from-[#0090DA] to-[#0060A0] p-6 rounded-2xl shadow-xl hover:shadow-[#0090DA]/40 hover:-translate-y-1 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p className="text-[#001026] text-xs font-black uppercase tracking-widest mb-1">VIEW LIST</p>
          <p className="text-white text-lg md:text-xl font-black italic leading-tight">みんなの<br />意気込み</p>
          <span className="absolute bottom-4 right-4 text-white/30 text-4xl">🔥</span>
        </button>

        <button
          onClick={() => setView('RESULT')}
          className="group relative overflow-hidden bg-gradient-to-br from-[#ffffff] to-[#e0e0e0] p-6 rounded-2xl shadow-xl hover:shadow-white/20 hover:-translate-y-1 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">VIEW RESULTS</p>
          <p className="text-[#001026] text-lg md:text-xl font-black italic leading-tight">みんなの<br />結果</p>
          <span className="absolute bottom-4 right-4 text-black/10 text-4xl">🏆</span>
        </button>
      </div>


      {/* --- FINAL ANSWER CONFIRM MODAL --- */}
      {showFinalAnswerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-[#0B1E38] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-blue-500/30 text-center transform scale-100">
            <h3 className="text-3xl font-black text-white italic mb-2 tracking-tighter">FINAL ANSWER?</h3>
            <p className="text-blue-300 font-bold mb-8">
              {isTargetExpired
                ? "この結果で確定しますか？"
                : "この目標で確定しますか？（暗証番号で後から変更可能です）"}
              <br />
              <span className="text-xs opacity-70">※ファイナルアンサー？</span>
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowFinalAnswerModal(false)}
                className="flex-1 py-4 text-gray-400 font-bold hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                BACK
              </button>
              <button
                onClick={handleFinalConfirm}
                className="flex-1 py-4 bg-gradient-to-r from-[#0090DA] to-[#34B6F3] text-[#001026] font-black rounded-xl shadow-[0_0_20px_rgba(0,144,218,0.4)] hover:shadow-[0_0_30px_rgba(0,144,218,0.6)] transition-all italic text-xl"
              >
                YES!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAIL MODAL --- */}
      {selectedParticipant && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className={`bg-[#0B1E38] w-full max-w-sm rounded-3xl shadow-2xl my-auto overflow-hidden border-2 ${selectedParticipant.category === 'k' ? 'border-[#0090DA]' : 'border-[#00D060]'}`}>

            {/* Modal Header */}
            <div className={`p-8 text-white bg-gradient-to-br ${selectedParticipant.category === 'k' ? 'from-[#0090DA] to-[#005090]' : 'from-[#00D060] to-[#008040]'} relative`}>
              <button onClick={handleCloseDetail} className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 rounded-full text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="inline-block px-3 py-1 rounded md:mb-2 text-[10px] font-black uppercase tracking-[0.2em] bg-black/30 text-white mb-2">
                {selectedParticipant.category === 'k' ? 'KOMATSU RACING' : 'PARTNER TEAM'}
              </div>
              <h2 className="text-4xl font-black italic tracking-tight">{selectedParticipant.name}</h2>
              {/* Detail Status Badge */}
              {selectedParticipant.temp_2026 && (
                <div className="mt-2 inline-block bg-black/40 text-white text-xs px-2 py-1 rounded font-bold border border-white/20">
                  {selectedParticipant.temp_2026}
                </div>
              )}
            </div>

            <div className="p-8 space-y-8 bg-[#0B1E38]">

              {/* History Section */}
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 border-b border-gray-700 pb-2">
                  RACE HISTORY
                </h3>
                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                  {['19', '20', '23', '24', '25'].map(y => (
                    <div key={y} className="flex flex-col">
                      <div className="text-[10px] text-gray-500 mb-1">'{y}</div>
                      <div className={`p-2 rounded font-black font-mono ${selectedParticipant.history[`20${y}`] ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-600'}`}>
                        {selectedParticipant.history[`20${y}`] || '-'}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedParticipant.average && (
                  <div className="mt-4 text-right text-xs text-blue-300">
                    AVG LAP: <span className="font-black text-xl text-white font-mono">{selectedParticipant.average}</span> MIN
                  </div>
                )}
              </div>

              {/* Input Section */}
              {isParticipating ? (
                <div className="space-y-6">

                  {/* TARGET TIME (Editable only BEFORE deadline) */}
                  <div className={`relative ${isExpired ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                    <label className="block text-sm font-bold text-gray-300 mb-2 flex justify-between items-end">
                      <span className="italic">TARGET TIME (2026)</span>
                      {!isExpired && !isLocked && <span className="text-[10px] text-[#0090DA] animate-pulse">EDITABLE</span>}
                      {isLocked && <span className="text-[10px] text-red-400 font-bold">LOCKED</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={targetTime}
                        onChange={(e) => setTargetTime(e.target.value)}
                        disabled={isLocked}
                        className={`w-full text-5xl font-black text-center p-6 bg-[#051426] border-2 rounded-2xl outline-none transition-all font-mono text-white ${isLocked ? 'border-gray-700 text-gray-500' : (selectedParticipant.category === 'k' ? 'border-[#0090DA] focus:shadow-[0_0_20px_rgba(0,144,218,0.3)]' : 'border-[#00D060] focus:shadow-[0_0_20px_rgba(0,208,96,0.3)]')}`}
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-600 font-bold text-sm tracking-widest">MIN</span>
                    </div>
                  </div>

                  {/* RESULT TIME (Editable only AFTER deadline) */}
                  {isExpired && (
                    <div className="animate-in slide-in-from-bottom duration-500 space-y-4">
                      <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/50">
                        <label className="block text-sm font-black text-red-500 mb-2 text-center italic tracking-wider">
                          OFFICIAL RESULT
                        </label>

                        {/* Retire Toggle */}
                        <div className="flex justify-center mb-4">
                          <label className="flex items-center gap-2 cursor-pointer bg-red-900/30 px-3 py-1 rounded-full border border-red-500/30">
                            <input
                              type="checkbox"
                              className="accent-red-500"
                              checked={resultTime === 'リタイア'}
                              onChange={(e) => {
                                setResultTime(e.target.checked ? 'リタイア' : '');
                              }}
                            />
                            <span className="text-white text-xs font-bold">途中棄権 (RETIRE)</span>
                          </label>
                        </div>

                        {resultTime !== 'リタイア' ? (
                          <div className="relative">
                            <input
                              type="number"
                              value={resultTime}
                              onChange={(e) => setResultTime(e.target.value)}
                              className="w-full text-4xl font-black text-center p-4 bg-black/50 border border-red-500/30 text-white rounded-xl outline-none focus:border-red-500 focus:shadow-[0_0_20px_rgba(239,68,68,0.3)] font-mono"
                              autoFocus
                              placeholder="000"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-red-500/50 font-bold text-xs">MIN</span>
                          </div>
                        ) : (
                          <div className="w-full text-4xl font-black text-center p-4 bg-black/50 border border-gray-500 text-gray-400 rounded-xl font-mono">
                            RETIRED
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PIN Input for Target Mode */}
                  {!isTargetExpired && (
                    <div className="mb-6">
                      <label className="text-xs text-[#0090DA] font-bold mb-2 block uppercase tracking-widest">
                        {selectedParticipant.pin ? 'ENTER PIN TO UPDATE (4 digits)' : 'SET PIN (4 digits)'}
                      </label>
                      <input
                        type="password" /* numeric ideally but password hides it */
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength="4"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        placeholder={selectedParticipant.pin ? "****" : "0000"}
                        className="w-full bg-black/30 border border-gray-600 rounded-lg p-3 text-white text-center text-xl tracking-[0.5em] font-mono focus:border-[#0090DA] outline-none placeholder-gray-700"
                      />
                      <p className="text-[10px] text-gray-500 text-center mt-1">
                        {selectedParticipant.pin
                          ? "※変更するには設定した暗証番号を入力してください"
                          : "※初回入力です。他人に変更されないよう設定してください"}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleSaveClick}
                    className={`w-full font-black py-5 px-6 rounded-xl shadow-lg transition-all active:scale-95 text-xl flex items-center justify-center gap-2 italic ${isTargetExpired
                      ? 'bg-gradient-to-r from-red-600 to-red-500 text-white'
                      : (selectedParticipant.category === 'k' ? 'bg-gradient-to-r from-[#0090DA] to-[#34B6F3] text-[#001026]' : 'bg-gradient-to-r from-[#00D060] to-[#40F080] text-[#002010]')
                      }`}
                  >
                    <span>{isTargetExpired ? 'SAVE RESULT' : (selectedParticipant.pin ? 'UPDATE TARGET' : 'LOCK TARGET')}</span>
                  </button>

                  {isTargetExpired && selectedParticipant.locked && !selectedParticipant.result_2026 && (
                    <div className="text-center mt-4">
                      <p className="text-yellow-500 text-sm animate-pulse">Waiting for Result Input...</p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-6 bg-white/5 rounded-2xl text-center border border-white/10">
                  <p className="text-gray-400 font-medium mb-1">NO RACE ENTRY</p>
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Status: {selectedParticipant.temp_2026}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ADMIN BUTTON (Footer) */}
      <div className="fixed bottom-4 right-4 z-10 opacity-30 hover:opacity-100 transition-opacity">
        <button
          onClick={() => {
            setDiceMinus(globalConfig.dice_minus || '');
            setDicePlus(globalConfig.dice_plus || '');
            // Deadlines default to existing config OR requested defaults
            setAdminTargetDeadline(globalConfig.target_deadline || '2026-01-25T10:59');
            setShowAdminModal(true);
          }}
          className="bg-black/50 text-white text-xs px-2 py-1 rounded border border-white/20"
        >
          ⚙️
        </button>
      </div>

      {/* --- ADMIN MODAL --- */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[80]">
          <div className="bg-[#0B1E38] w-full max-w-sm rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Admin Config</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">DICE 1 (原田) - TIME REDUCTION</label>
                <input
                  type="number"
                  value={diceMinus}
                  onChange={(e) => setDiceMinus(e.target.value)}
                  className="w-full bg-black/30 border border-red-900 rounded p-2 text-white font-mono text-xl text-center"
                  placeholder="Minus"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">DICE 2 (柳沢) - TIME ADDITION</label>
                <input
                  type="number"
                  value={dicePlus}
                  onChange={(e) => setDicePlus(e.target.value)}
                  className="w-full bg-black/30 border border-green-900 rounded p-2 text-white font-mono text-xl text-center"
                  placeholder="Plus"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">TARGET DEADLINE (目標入力期限)</label>
                <input
                  type="datetime-local"
                  value={adminTargetDeadline}
                  onChange={(e) => setAdminTargetDeadline(e.target.value)}
                  className="w-full bg-black/30 border border-yellow-600 rounded p-2 text-white font-mono text-sm text-center mb-2"
                />
                <p className="text-[10px] text-gray-500 text-center">※この期限を過ぎると結果入力モードに切り替わります</p>
              </div>



              <div className="pt-4 border-t border-gray-700">
                <label className="text-xs text-gray-400 block mb-1">ADMIN PASSWORD</label>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full bg-black/30 border border-gray-600 rounded p-2 text-white text-center"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2 bg-gray-700 rounded text-gray-300 text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleAdminSave}
                  className="flex-1 py-2 bg-blue-600 rounded text-white font-bold text-sm"
                >
                  SAVE CONFIG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {successMessage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-[#0B1E38] w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-[#0090DA] text-center transform scale-100">
            <div className="text-6xl mb-4">👍</div>
            <h3 className="text-2xl font-black text-white italic mb-4 tracking-tighter">SUCCESS!</h3>
            <p className="text-white font-bold text-lg mb-8 whitespace-pre-line">
              {successMessage}
            </p>
            <button
              onClick={handleCloseSuccess}
              className="w-full py-4 bg-gradient-to-r from-[#0090DA] to-[#34B6F3] text-[#001026] font-black rounded-xl shadow-[0_0_20px_rgba(0,144,218,0.4)] hover:shadow-[0_0_30px_rgba(0,144,218,0.6)] transition-all italic text-xl"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* --- RULES MODAL --- */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[90] animate-in fade-in duration-200">
          <div className="bg-[#0B1E38] w-full max-w-lg rounded-3xl p-8 border border-white/10 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowRulesModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-black text-white italic mb-6 border-b border-white/10 pb-4">
              使い方・チャリティールール
            </h2>

            <div className="space-y-6 text-sm text-gray-300">
              <section>
                <h3 className="text-[#0090DA] font-bold text-lg mb-2">🏁 使い方</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>自分の名前を選択して、目標タイムを入力してください。</li>
                  <li>
                    <span className="text-white font-bold">初回入力時に4桁の暗証番号を設定</span>します。
                    後から変更する場合に必要になるので忘れないでください。
                  </li>
                  <li>目標入力期限（スタート前）までは何度でも変更可能です。</li>
                  <li>
                    期限を過ぎると<span className="text-white font-bold">結果入力モード</span>に切り替わります。
                    自分の名前を選択し、結果タイムを入力してください。
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-[#00D060] font-bold text-lg mb-2">💰 チャリティー額の決定ルール</h3>
                <p className="mb-2">目標タイムと実際のタイム（サイコロ補正後）の差分に応じてチャリティー（寄付）をしていただきます。</p>

                <div className="bg-black/30 p-4 rounded-xl font-mono text-xs md:text-sm border border-white/5 space-y-2">
                  <p className="font-bold text-center text-white mb-2">[ 計算式 ]</p>
                  <p className="text-center">
                    (( 結果 - <span className="text-red-400">Dice1</span> + <span className="text-green-400">Dice2</span> ) - 目標 ) × 500円
                  </p>
                </div>

                <ul className="list-disc pl-5 space-y-2 mt-4">
                  <li>調整後タイムと目標タイムの差 <span className="text-white font-bold">1分につき500円</span>。</li>
                  <li>速くても遅くても、差分がそのままチャリティー額になります。</li>
                  <li><span className="text-white font-bold">上限は 5,000円</span> です。</li>
                  <li><span className="text-white font-bold">リタイア</span> の場合は一律 5,000円 となります。</li>
                </ul>
              </section>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
