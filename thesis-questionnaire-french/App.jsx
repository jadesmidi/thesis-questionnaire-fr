import { useState, useEffect, useRef } from "react";

const PARTIES = ["Renaissance", "LR", "Les Écologistes", "PS", "Horizons", "RN", "Reconquête", "DLF"];

const STORAGE_KEY = "thesis_responses_fr";

// ─── Utility ────────────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ["1er", "2e", "3e", "4e", "5e", "6e", "7e", "8e"];
  return s[n] || `${n + 1}e`;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

const SHEET_URL = "https://script.google.com/macros/s/AKfycbwM6DCkPoysghbQt1dJM0BMJh4Kbif2fai0rqivil5pkOGj5CbNZBq-Y1LdAEC_nkH0/exec";

async function saveResponse(data) {
  await fetch(SHEET_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

async function loadResponses() {
  try {
    const r = await window.storage.get(STORAGE_KEY, true);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}

// ─── Slider Component ─────────────────────────────────────────────────────────

function ApprovalSlider({ party, value, onChange }) {
  const trackRef = useRef(null);
  const isDragging = useRef(false);

  const pct = ((value + 5) / 10) * 100;

  const getValueFromEvent = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 10 - 5);
  };

  const onStart = (e) => { isDragging.current = true; onChange(getValueFromEvent(e)); };
  const onMove = (e) => { if (!isDragging.current) return; onChange(getValueFromEvent(e)); };
  const onEnd = () => { isDragging.current = false; };

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  });

  const color = value < 0 ? `hsl(${10 + (value + 5) * 8}, 80%, 55%)` : value > 0 ? `hsl(${140 + value * 4}, 70%, 45%)` : "#8b8fa8";

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{party}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color, minWidth: 32, textAlign: "right" }}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <div style={{ position: "relative", height: 36, display: "flex", alignItems: "center", cursor: "pointer" }}
        ref={trackRef} onMouseDown={onStart} onTouchStart={onStart}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, background: "#e2e4ef" }} />
        <div style={{ position: "absolute", left: "50%", width: 2, height: 14, background: "#c5c7d8", borderRadius: 1, transform: "translateX(-50%)" }} />
        <div style={{
          position: "absolute", height: 6, borderRadius: 3,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          left: value >= 0 ? "50%" : `${pct}%`,
          width: Math.abs(value / 10 * 100) + "%",
          transition: "background 0.2s"
        }} />
        <div style={{
          position: "absolute", left: `${pct}%`, transform: "translateX(-50%)",
          width: 22, height: 22, borderRadius: "50%",
          background: color, border: "3px solid white",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          cursor: "grab", transition: "background 0.2s, transform 0.1s",
          zIndex: 2
        }} />
        <div style={{ position: "absolute", left: 0, bottom: -18, fontSize: 11, color: "#8b8fa8", fontFamily: "'DM Mono', monospace" }}>−5</div>
        <div style={{ position: "absolute", right: 0, bottom: -18, fontSize: 11, color: "#8b8fa8", fontFamily: "'DM Mono', monospace" }}>+5</div>
        <div style={{ position: "absolute", left: "50%", bottom: -18, fontSize: 11, color: "#8b8fa8", fontFamily: "'DM Mono', monospace", transform: "translateX(-50%)" }}>0</div>
      </div>
    </div>
  );
}

// ─── Ranking Component ────────────────────────────────────────────────────────

function RankingList({ ranking, setRanking, pool, setPool }) {
  const [dragSrc, setDragSrc] = useState(null);
  const [overRanked, setOverRanked] = useState(null);

  const addToRanking = (party) => {
    setPool(p => p.filter(x => x !== party));
    setRanking(r => [...r, party]);
  };

  const removeFromRanking = (i) => {
    const party = ranking[i];
    setRanking(r => r.filter((_, idx) => idx !== i));
    setPool(p => [...p, party]);
  };

  const onDragStartRanked = (e, i) => { setDragSrc({ from: "ranked", index: i }); };
  const onDragOverRanked = (e, i) => { e.preventDefault(); setOverRanked(i); };
  const onDropRanked = (i) => {
    if (!dragSrc) return;
    if (dragSrc.from === "ranked") {
      const next = [...ranking];
      const [item] = next.splice(dragSrc.index, 1);
      next.splice(i, 0, item);
      setRanking(next);
    }
    setDragSrc(null); setOverRanked(null);
  };
  const onDragEnd = () => { setDragSrc(null); setOverRanked(null); };

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 180px" }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#8b8fa8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Partis disponibles
        </p>
        <div style={{ minHeight: 60, background: "#f4f5fb", borderRadius: 10, padding: 8 }}>
          {pool.length === 0
            ? <p style={{ fontSize: 13, color: "#b0b3c8", fontFamily: "'DM Sans', sans-serif", textAlign: "center", padding: "12px 0" }}>Tous les partis classés ✓</p>
            : pool.map(party => (
              <div key={party} onClick={() => addToRanking(party)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", marginBottom: 6, borderRadius: 8,
                  background: "white", border: "2px solid #e2e4ef",
                  cursor: "pointer", transition: "all 0.15s",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "#1a1a2e",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#f0f1ff"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e4ef"; e.currentTarget.style.background = "white"; }}>
                {party}
                <span style={{ fontSize: 16, color: "#6366f1" }}>+</span>
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ flex: "1 1 220px" }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Votre classement ({ranking.length}/{PARTIES.length})
        </p>
        <div style={{ minHeight: 60, background: "#f0f1ff", borderRadius: 10, padding: 8 }}>
          {ranking.length === 0
            ? <p style={{ fontSize: 13, color: "#b0b3c8", fontFamily: "'DM Sans', sans-serif", textAlign: "center", padding: "12px 0" }}>Cliquez sur un parti pour commencer</p>
            : ranking.map((party, i) => (
              <div key={party} draggable
                onDragStart={(e) => onDragStartRanked(e, i)}
                onDragOver={(e) => onDragOverRanked(e, i)}
                onDrop={() => onDropRanked(i)}
                onDragEnd={onDragEnd}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", marginBottom: 6, borderRadius: 8,
                  background: overRanked === i ? "#e0e1ff" : "white",
                  border: `2px solid ${overRanked === i ? "#6366f1" : "#c7c9f0"}`,
                  cursor: "grab", transition: "all 0.15s",
                  boxShadow: "0 1px 4px rgba(99,102,241,0.1)"
                }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6366f1", fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                <span style={{ fontSize: 14 }}>⠿</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "#1a1a2e", flex: 1 }}>{party}</span>
                <button onClick={() => removeFromRanking(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#c0c3d8", fontSize: 16, padding: "0 2px", lineHeight: 1 }}
                  title="Retirer du classement">×</button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── Coalition Choice ────────────────────────────────────────────────────────

function CoalitionChoice({ question, optionA, optionB, value, onChange }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15, color: "#1a1a2e", marginBottom: 12 }}>{question}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[optionA, optionB].map((opt, idx) => (
          <button key={idx} onClick={() => onChange(idx === 0 ? "A" : "B")}
            style={{
              padding: "14px 22px", borderRadius: 10, border: `2px solid ${value === (idx === 0 ? "A" : "B") ? "#6366f1" : "#dde0ef"}`,
              background: value === (idx === 0 ? "A" : "B") ? "linear-gradient(135deg, #6366f1, #818cf8)" : "white",
              color: value === (idx === 0 ? "A" : "B") ? "white" : "#1a1a2e",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
              cursor: "pointer", transition: "all 0.2s", boxShadow: value === (idx === 0 ? "A" : "B") ? "0 4px 16px rgba(99,102,241,0.3)" : "none"
            }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }) {
  return (
    <div style={{ width: "100%", height: 4, background: "#e2e4ef", borderRadius: 2, marginBottom: 32 }}>
      <div style={{ height: "100%", width: `${(step / total) * 100}%`, background: "linear-gradient(90deg, #6366f1, #a78bfa)", borderRadius: 2, transition: "width 0.4s ease" }} />
    </div>
  );
}

// ─── Admin View ───────────────────────────────────────────────────────────────

function AdminView({ onBack }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadResponses().then(r => { setResponses(r); setLoading(false); });
  }, []);

  const downloadCSV = () => {
    if (!responses.length) return;
    const cols = ["id", "submittedAt", "age", "background", "lastVote",
      "ranking", "approvals",
      "coal_attention", "coal_1", "coal_2", "coal_3", "coal_4", "coal_A", "coal_B", "coal_5", "coal_C", "feedback"];
    const rows = responses.map(r => cols.map(c => {
      const v = r[c];
      if (typeof v === "object") return JSON.stringify(v);
      return `"${String(v || "").replace(/"/g, '""')}"`;
    }).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "thesis_responses_fr.csv"; a.click();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6366f1" }}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5fb", padding: "40px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a1a2e", margin: 0 }}>📊 Réponses (FR)</h1>
            <p style={{ color: "#8b8fa8", margin: "4px 0 0", fontFamily: "'DM Sans', sans-serif" }}>{responses.length} réponses</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={downloadCSV} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer" }}>⬇ Télécharger CSV</button>
            <button onClick={onBack} style={{ padding: "10px 20px", borderRadius: 8, border: "2px solid #dde0ef", background: "white", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer", color: "#1a1a2e" }}>← Retour</button>
          </div>
        </div>

        {responses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "white", borderRadius: 16, color: "#8b8fa8", fontFamily: "'DM Sans', sans-serif" }}>Aucune réponse pour l'instant.</div>
        ) : (
          responses.map((r, i) => (
            <div key={r.id} onClick={() => setSelected(selected === i ? null : i)}
              style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 12, cursor: "pointer", border: "2px solid", borderColor: selected === i ? "#6366f1" : "transparent", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: "#1a1a2e" }}>Répondant #{i + 1}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#8b8fa8" }}>{new Date(r.submittedAt).toLocaleString("fr-FR")}</span>
              </div>
              <div style={{ marginTop: 4, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#6366f1" }}>
                {r.age} ans · {r.background} · A voté : {r.lastVote}
              </div>
              {selected === i && (
                <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <strong style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#8b8fa8" }}>CLASSEMENT</strong>
                      <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
                        {(r.ranking || []).map((p, j) => <li key={j}>{p}</li>)}
                      </ol>
                    </div>
                    <div>
                      <strong style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#8b8fa8" }}>APPROBATIONS</strong>
                      <div style={{ marginTop: 8 }}>
                        {Object.entries(r.approvals || {}).map(([p, v]) => (
                          <div key={p} style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span>{p}</span><span style={{ color: v > 0 ? "#16a34a" : v < 0 ? "#dc2626" : "#8b8fa8" }}>{v > 0 ? `+${v}` : v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <strong style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#8b8fa8" }}>CHOIX DE COALITION</strong>
                    {[
                      ["V0: {1,2} vs {3,4}", "coal_attention"],
                      ["V1: {1} vs {2,3,4}", "coal_1"],
                      ["V2: {1,2,3} vs {1,2}", "coal_2"],
                      ["V3: {1,8} vs {4,5}", "coal_3"],
                      ["V4: {1,3,8} vs {3,4,5}", "coal_4"],
                      ["V5: {1,3} vs {2,4}", "coal_A"],
                      ["V6: {1,3,5} vs {2,4,5}", "coal_B"],
                      ["V7: influence A", "coal_5"],
                      ["V8: influence B", "coal_C"],
                    ].map(([lbl, key]) => (
                      <div key={key} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, marginTop: 6 }}>
                        <span style={{ color: "#8b8fa8" }}>{lbl}:</span> {r[key] || "—"}
                      </div>
                    ))}
                  </div>
                  {r.feedback && (
                    <div style={{ marginTop: 16, background: "#f4f5fb", borderRadius: 8, padding: 12 }}>
                      <strong style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#8b8fa8" }}>COMMENTAIRES</strong>
                      <p style={{ margin: "6px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a2e" }}>{r.feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [age, setAge] = useState("");
  const [background, setBackground] = useState("");
  const [lastVote, setLastVote] = useState("");
  const [consented, setConsented] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [pool, setPool] = useState([...PARTIES]);
  const [approvals, setApprovals] = useState(Object.fromEntries(PARTIES.map(p => [p, 0])));
  const [coal0, setCoal0] = useState("");
  const [coal1, setCoal1] = useState("");
  const [coal2, setCoal2] = useState("");
  const [coal3, setCoal3] = useState("");
  const [coal4, setCoal4] = useState("");
  const [coalA, setCoalA] = useState("");
  const [coalB, setCoalB] = useState("");
  const [coal5, setCoal5] = useState("");
  const [coalC, setCoalC] = useState("");
  const [feedback, setFeedback] = useState("");

  const r = ranking;

  const handleSubmit = async () => {
    setSaving(true);
    await saveResponse({
      age, background, lastVote,
      ranking, approvals,
      coal_attention: coal0,
      coal_1: coal1, coal_2: coal2, coal_3: coal3, coal_4: coal4,
      coal_A: coalA, coal_B: coalB,
      coal_5: coal5, coal_C: coalC,
      feedback
    });
    setSaving(false);
    setPage(5);
  };

  const btnStyle = (disabled) => ({
    padding: "14px 32px", borderRadius: 10, border: "none",
    background: disabled ? "#dde0ef" : "linear-gradient(135deg, #6366f1, #818cf8)",
    color: disabled ? "#a0a3b8" : "white",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 4px 16px rgba(99,102,241,0.3)",
    transition: "all 0.2s"
  });

  const inputStyle = {
    padding: "12px 16px", borderRadius: 8, border: "2px solid #e2e4ef",
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a2e",
    background: "white", width: "100%", outline: "none", boxSizing: "border-box"
  };

  const container = {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #f0f1ff 0%, #fafafa 50%, #f0f4ff 100%)",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "40px 20px", fontFamily: "'DM Sans', sans-serif"
  };

  const card = {
    background: "white", borderRadius: 20, padding: "40px 44px",
    maxWidth: 640, width: "100%",
    boxShadow: "0 8px 40px rgba(99,102,241,0.1), 0 1px 8px rgba(0,0,0,0.04)"
  };

  const label = {
    display: "block", fontWeight: 700, fontSize: 13, color: "#6366f1",
    letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, marginTop: 24
  };

  if (adminMode) return <AdminView onBack={() => setAdminMode(false)} />;

  return (
    <div style={container}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600;700&family=DM+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ maxWidth: 640, width: "100%", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#1a1a2e", margin: 0, letterSpacing: "-0.02em" }}>Étude sur les Préférences de Coalition</h1>
          <p style={{ color: "#8b8fa8", margin: "4px 0 0", fontSize: 13 }}>Mémoire de Licence · Science Politique</p>
        </div>
        <button onClick={() => setShowAdminLogin(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: 0.4 }}>🔒</button>
      </div>

      {showAdminLogin && (
        <div style={{ maxWidth: 640, width: "100%", marginBottom: 16, background: "white", borderRadius: 12, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", display: "flex", gap: 10 }}>
          <input placeholder="Mot de passe admin" type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)}
            style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => { if (adminInput === "thesis2025") { setAdminMode(true); setShowAdminLogin(false); } else alert("Mot de passe incorrect"); }}
            style={{ ...btnStyle(false), padding: "12px 20px", fontSize: 14 }}>Connexion</button>
        </div>
      )}

      <div style={card}>
        {page < 5 && <ProgressBar step={page} total={4} />}

        {/* PAGE 0 — Consent */}
        {page === 0 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a1a2e", marginTop: 0 }}>Bonjour ! 👋</h2>
            <div style={{ background: "linear-gradient(135deg, #f0f1ff, #f8f0ff)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "#1a1a2e", margin: 0 }}>
                Merci de vouloir participer à cette étude ! Dans le cadre de mon mémoire de licence, je recherche quelle coalition est la plus faisable et avec laquelle le plus grand nombre de personnes serait satisfait, sur la base des préférences et classements individuels des partis politiques. En participant, je collecte des données pour tester <strong>différentes méthodes et règles</strong> de formation de coalitions. Votre participation m'aide énormément !
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "#1a1a2e", margin: "12px 0 0" }}>
                ⏱️ Participer ne prend que <strong>5 minutes environ</strong>.
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "#1a1a2e", margin: "12px 0 0" }}>
                🔒 <strong>Toutes vos réponses restent totalement anonymes</strong> et seront utilisées uniquement dans le cadre de mon mémoire de licence.
              </p>
            </div>

            <div onClick={() => setConsented(v => !v)} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", borderRadius: 10, border: `2px solid ${consented ? "#6366f1" : "#e2e4ef"}`, background: consented ? "#f0f1ff" : "white", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${consented ? "#6366f1" : "#d0d3e8"}`, background: consented ? "#6366f1" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                {consented && <span style={{ color: "white", fontSize: 14, fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", lineHeight: 1.5 }}>
                J'accepte les informations ci-dessus et je donne mon consentement pour l'utilisation anonyme de mes réponses dans le cadre de cette étude.
              </span>
            </div>

            <p style={{ fontSize: 15, color: "#8b8fa8", marginTop: 20, fontStyle: "italic" }}>Merci d'avance pour votre participation ! 🙏</p>

            <div style={{ marginTop: 24 }}>
              <button disabled={!consented} onClick={() => setPage(1)} style={btnStyle(!consented)}>Continuer →</button>
            </div>
          </div>
        )}

        {/* PAGE 1 — Personal */}
        {page === 1 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a1a2e", marginTop: 0 }}>Questions Personnelles</h2>
            <p style={{ color: "#8b8fa8", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Partie 2 sur 4 · Veuillez répondre aux questions suivantes.</p>

            <label style={label}>1. Quel est votre âge ?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["18", "19", "20", "21", "22", "23", "24", "25", "25+"].map(a => (
                <button key={a} onClick={() => setAge(a)} style={{
                  padding: "9px 18px", borderRadius: 8, border: `2px solid ${age === a ? "#6366f1" : "#e2e4ef"}`,
                  background: age === a ? "linear-gradient(135deg, #6366f1, #818cf8)" : "white",
                  color: age === a ? "white" : "#1a1a2e", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.15s"
                }}>{a}</button>
              ))}
            </div>

            <label style={label}>2. Quel est votre niveau d'études ?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Lycée", "BTS / DUT", "Licence", "Master", "Doctorat", "En activité professionnelle"].map(a => (
                <button key={a} onClick={() => setBackground(a)} style={{
                  padding: "10px 16px", borderRadius: 8, border: `2px solid ${background === a ? "#6366f1" : "#e2e4ef"}`,
                  background: background === a ? "linear-gradient(135deg, #6366f1, #818cf8)" : "white",
                  color: background === a ? "white" : "#1a1a2e", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.15s", textAlign: "left"
                }}>{a}</button>
              ))}
            </div>

            <label style={label}>3. Pour quel parti avez-vous voté lors des dernières élections nationales ?</label>
            <input style={inputStyle} placeholder="Ex. Renaissance, RN, LFI..." value={lastVote} onChange={e => setLastVote(e.target.value)} />

            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              <button onClick={() => setPage(0)} style={{ ...btnStyle(false), background: "white", color: "#6366f1", border: "2px solid #6366f1", boxShadow: "none" }}>← Retour</button>
              <button disabled={!age || !background || !lastVote.trim()} onClick={() => setPage(2)} style={btnStyle(!age || !background || !lastVote.trim())}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* PAGE 2 — Ranking + Approval */}
        {page === 2 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a1a2e", marginTop: 0 }}>Vos Préférences</h2>
            <p style={{ color: "#8b8fa8", fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
              Pour cette expérience, j'ai sélectionné les <strong>8 plus grands partis de France</strong>.
            </p>

            <label style={label}>1. Quel est votre classement des partis proposés ?</label>
            <p style={{ color: "#8b8fa8", fontSize: 13, marginBottom: 12 }}>Cliquez sur un parti pour l'ajouter à votre classement. Faites ensuite glisser pour ajuster l'ordre. Vous devez classer tous les partis pour continuer.</p>
            <RankingList ranking={ranking} setRanking={setRanking} pool={pool} setPool={setPool} />

            <label style={{ ...label, marginTop: 36 }}>2. Quel est votre taux d'approbation de ces partis ?</label>
            <p style={{ color: "#8b8fa8", fontSize: 13, marginBottom: 20 }}>
              <strong>−5</strong> = je ne voudrais vraiment pas ce parti dans la coalition &nbsp;·&nbsp; <strong>0</strong> = neutre &nbsp;·&nbsp; <strong>+5</strong> = je voudrais vraiment ce parti dans la coalition
            </p>
            <div style={{ marginBottom: 32 }}>
              {PARTIES.map(p => (
                <ApprovalSlider key={p} party={p} value={approvals[p]} onChange={v => setApprovals(prev => ({ ...prev, [p]: v }))} />
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button onClick={() => setPage(1)} style={{ ...btnStyle(false), background: "white", color: "#6366f1", border: "2px solid #6366f1", boxShadow: "none" }}>← Retour</button>
              <button disabled={ranking.length < PARTIES.length} onClick={() => setPage(3)} style={btnStyle(ranking.length < PARTIES.length)}>Suivant →</button>
            </div>
          </div>
        )}

        {/* PAGE 3 — Coalition Comparisons */}
        {page === 3 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a1a2e", marginTop: 0 }}>Comparaisons de Coalitions</h2>
            <p style={{ color: "#8b8fa8", fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
              Les ensembles ci-dessous sont personnalisés selon votre classement.
              Les chiffres (1, 2, 3…) correspondent à votre <strong>{ordinal(0)}, {ordinal(1)}, {ordinal(2)}…</strong> choix.
            </p>
            <div style={{ background: "#f4f5fb", borderRadius: 10, padding: "10px 14px", marginBottom: 24, fontSize: 13, color: "#6366f1", fontFamily: "'DM Mono', monospace" }}>
              1={r[0]} · 2={r[1]} · 3={r[2]} · 4={r[3]} · 5={r[4]} · 6={r[5]} · 7={r[6]} · 8={r[7]}
            </div>

            <p style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e", marginBottom: 20 }}>Quel ensemble de partis préféreriez-vous dans la coalition ?</p>

            <CoalitionChoice
              question={`Question 0 : {${r[0]}, ${r[1]}} ou {${r[2]}, ${r[3]}} ?`}
              optionA={`{${r[0]}, ${r[1]}}`}
              optionB={`{${r[2]}, ${r[3]}}`}
              value={coal0} onChange={setCoal0}
            />

            <div style={{ borderTop: "1px solid #eee", paddingTop: 20, marginTop: 4 }}>
              <CoalitionChoice
                question={`Question 1 : {${r[0]}} ou {${r[1]}, ${r[2]}, ${r[3]}} ?`}
                optionA={`{${r[0]}}`}
                optionB={`{${r[1]}, ${r[2]}, ${r[3]}}`}
                value={coal1} onChange={setCoal1}
              />
              <CoalitionChoice
                question={`Question 2 : {${r[0]}, ${r[1]}, ${r[2]}} ou {${r[0]}, ${r[1]}} ?`}
                optionA={`{${r[0]}, ${r[1]}, ${r[2]}}`}
                optionB={`{${r[0]}, ${r[1]}}`}
                value={coal2} onChange={setCoal2}
              />
              <CoalitionChoice
                question={`Question 3 : {${r[0]}, ${r[7]}} ou {${r[3]}, ${r[4]}} ?`}
                optionA={`{${r[0]}, ${r[7]}}`}
                optionB={`{${r[3]}, ${r[4]}}`}
                value={coal3} onChange={setCoal3}
              />
              <CoalitionChoice
                question={`Question 4 : {${r[0]}, ${r[2]}, ${r[7]}} ou {${r[2]}, ${r[3]}, ${r[4]}} ?`}
                optionA={`{${r[0]}, ${r[2]}, ${r[7]}}`}
                optionB={`{${r[2]}, ${r[3]}, ${r[4]}}`}
                value={coal4} onChange={setCoal4}
              />
              <CoalitionChoice
                question={`Question 5 : {${r[0]}, ${r[2]}} ou {${r[1]}, ${r[3]}} ?`}
                optionA={`{${r[0]}, ${r[2]}}`}
                optionB={`{${r[1]}, ${r[3]}}`}
                value={coalA} onChange={setCoalA}
              />
              <CoalitionChoice
                question={`Question 6 : {${r[0]}, ${r[2]}, ${r[4]}} ou {${r[1]}, ${r[3]}, ${r[4]}} ?`}
                optionA={`{${r[0]}, ${r[2]}, ${r[4]}}`}
                optionB={`{${r[1]}, ${r[3]}, ${r[4]}}`}
                value={coalB} onChange={setCoalB}
              />
            </div>

            <div style={{ borderTop: "1px solid #eee", paddingTop: 24, marginTop: 8 }}>
              <p style={{ fontSize: 14, color: "#8b8fa8", marginBottom: 16 }}>Les questions suivantes tiennent également compte de <strong>l'influence des partis</strong> dans la coalition :</p>
              <CoalitionChoice
                question={`Question 7 : {${r[0]} (20%), ${r[2]} (80%)} ou {${r[0]} (60%), ${r[5]} (40%)} ?`}
                optionA={`{${r[0]}: 20%, ${r[2]}: 80%}`}
                optionB={`{${r[0]}: 60%, ${r[5]}: 40%}`}
                value={coal5} onChange={setCoal5}
              />
              <CoalitionChoice
                question={`Question 8 : {${r[2]} (50%), ${r[3]} (50%)} ou {${r[0]} (50%), ${r[7]} (50%)} ?`}
                optionA={`{${r[2]}: 50%, ${r[3]}: 50%}`}
                optionB={`{${r[0]}: 50%, ${r[7]}: 50%}`}
                value={coalC} onChange={setCoalC}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setPage(2)} style={{ ...btnStyle(false), background: "white", color: "#6366f1", border: "2px solid #6366f1", boxShadow: "none" }}>← Retour</button>
              <button disabled={!coal0 || !coal1 || !coal2 || !coal3 || !coal4 || !coalA || !coalB || !coal5 || !coalC} onClick={() => setPage(4)} style={btnStyle(!coal0 || !coal1 || !coal2 || !coal3 || !coal4 || !coalA || !coalB || !coal5 || !coalC)}>Suivant →</button>
            </div>
          </div>
        )}

        {/* PAGE 4 — Feedback */}
        {page === 4 && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a1a2e", marginTop: 0 }}>Questions ou Commentaires ?</h2>
            <p style={{ color: "#8b8fa8", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Avez-vous des questions, remarques ou commentaires sur cette étude ? N'hésitez pas à les laisser ci-dessous. C'est entièrement optionnel.
            </p>
            <textarea
              value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="Vous pouvez répondre librement ici..."
              style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.6 }}
            />
            <p style={{ fontSize: 14, color: "#8b8fa8", marginTop: 20, lineHeight: 1.7 }}>
              Merci beaucoup d'avoir rempli ce questionnaire ! 🎉
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setPage(3)} style={{ ...btnStyle(false), background: "white", color: "#6366f1", border: "2px solid #6366f1", boxShadow: "none" }}>← Retour</button>
              <button onClick={handleSubmit} disabled={saving} style={btnStyle(saving)}>{saving ? "Enregistrement..." : "Envoyer mes réponses 🚀"}</button>
            </div>
          </div>
        )}

        {/* PAGE 5 — Done */}
        {page === 5 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎓</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#1a1a2e" }}>Merci !</h2>
            <p style={{ color: "#8b8fa8", fontSize: 15, lineHeight: 1.75 }}>
              Vos réponses ont été enregistrées de manière anonyme et seront utilisées dans le cadre de mon mémoire de licence sur la faisabilité des coalitions.<br /><br />
              Merci beaucoup pour votre précieuse participation ! 🙏
            </p>
            <div style={{ marginTop: 24, padding: "16px 20px", background: "#f0f1ff", borderRadius: 10, fontSize: 14, color: "#6366f1", fontWeight: 600 }}>
              Vous pouvez fermer cet onglet.
            </div>
          </div>
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: "#c0c3d8" }}>Mémoire de Licence · Toutes les données sont traitées de manière anonyme</p>
    </div>
  );
}
