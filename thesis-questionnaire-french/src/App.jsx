import { useState, useEffect, useRef } from "react";

const PARTIES = ["Renaissance", "Les Républicains", "Les Écologistes", "PS", "PCF", "Rassemblement National", "Reconquête", "LFI"];
const FR_VOTE_OPTIONS = ["Renaissance","Rassemblement National","LFI","PS","LR","Les Écologistes","Horizons","Reconquête","DLF","PCF","Parti Animaliste","UDI","Divers gauche","Divers droite","N'a pas voté","Blanc","Préfère ne pas répondre","Autre"];
const STORAGE_KEY = "thesis_responses_fr";

function ordinal(n) {
  const s = ["1er","2e","3e","4e","5e","6e","7e","8e"];
  return s[n] || `${n+1}e`;
}

const SHEET_URL = "https://script.google.com/macros/s/AKfycbxOvyHjabpaO1_4FFz77RfqnswPl9XFlQoVyuUJMmCvEIscwVO14lTU6in5NPDdItt1/exec";

async function saveResponse(data) {
  try {
    await fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error("Failed to save:", error);
  }
}

// ─── Slider ───────────────────────────────────────────────────────────────────
function ApprovalSlider({ party, value, onChange }) {
  const trackRef = useRef(null);
  const isDragging = useRef(false);
  const pct = ((value + 5) / 10) * 100;
  const getVal = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 10 - 5);
  };
  const onStart = (e) => { isDragging.current = true; onChange(getVal(e)); };
  const onMove = (e) => { if (isDragging.current) onChange(getVal(e)); };
  const onEnd = () => { isDragging.current = false; };
  useEffect(() => {
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove); window.addEventListener("touchend", onEnd);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onEnd); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
  });
  const color = value < 0 ? `hsl(${10+(value+5)*8},80%,55%)` : value > 0 ? `hsl(${140+value*4},70%,45%)` : "#8b8fa8";
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:600, color:"#1a1a2e" }}>{party}</span>
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:700, color, minWidth:32, textAlign:"right" }}>{value > 0 ? `+${value}` : value}</span>
      </div>
      <div style={{ position:"relative", height:36, display:"flex", alignItems:"center", cursor:"pointer" }} ref={trackRef} onMouseDown={onStart} onTouchStart={onStart}>
        <div style={{ position:"absolute", left:0, right:0, height:6, borderRadius:3, background:"#e2e4ef" }} />
        <div style={{ position:"absolute", left:"50%", width:2, height:14, background:"#c5c7d8", borderRadius:1, transform:"translateX(-50%)" }} />
        <div style={{ position:"absolute", height:6, borderRadius:3, background:`linear-gradient(90deg,${color},${color}cc)`, left:value>=0?"50%":`${pct}%`, width:Math.abs(value/10*100)+"%", transition:"background 0.2s" }} />
        <div style={{ position:"absolute", left:`${pct}%`, transform:"translateX(-50%)", width:22, height:22, borderRadius:"50%", background:color, border:"3px solid white", boxShadow:"0 2px 8px rgba(0,0,0,0.25)", cursor:"grab", zIndex:2 }} />
        <div style={{ position:"absolute", left:0, bottom:-18, fontSize:11, color:"#8b8fa8", fontFamily:"'DM Mono',monospace" }}>−5</div>
        <div style={{ position:"absolute", right:0, bottom:-18, fontSize:11, color:"#8b8fa8", fontFamily:"'DM Mono',monospace" }}>+5</div>
        <div style={{ position:"absolute", left:"50%", bottom:-18, fontSize:11, color:"#8b8fa8", fontFamily:"'DM Mono',monospace", transform:"translateX(-50%)" }}>0</div>
      </div>
    </div>
  );
}

// ─── Ranking ──────────────────────────────────────────────────────────────────
function RankingList({ ranking, setRanking, pool, setPool }) {
  const [dragSrc, setDragSrc] = useState(null);
  const [overRanked, setOverRanked] = useState(null);
  const addToRanking = (party) => { setPool(p => p.filter(x => x !== party)); setRanking(r => [...r, party]); };
  const removeFromRanking = (i) => { const p = ranking[i]; setRanking(r => r.filter((_,j) => j !== i)); setPool(p2 => [...p2, p]); };
  const onDragStartRanked = (e, i) => setDragSrc({ from:"ranked", index:i });
  const onDragOverRanked = (e, i) => { e.preventDefault(); setOverRanked(i); };
  const onDropRanked = (i) => {
    if (!dragSrc) return;
    if (dragSrc.from === "ranked") { const next=[...ranking]; const [item]=next.splice(dragSrc.index,1); next.splice(i,0,item); setRanking(next); }
    setDragSrc(null); setOverRanked(null);
  };
  return (
    <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
      <div style={{ flex:"1 1 180px" }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, color:"#8b8fa8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Partis disponibles</p>
        <div style={{ minHeight:60, background:"#f4f5fb", borderRadius:10, padding:8 }}>
          {pool.length === 0
            ? <p style={{ fontSize:13, color:"#b0b3c8", fontFamily:"'DM Sans',sans-serif", textAlign:"center", padding:"12px 0" }}>Tous les partis classés ✓</p>
            : pool.map(party => (
              <div key={party} onClick={() => addToRanking(party)}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", marginBottom:6, borderRadius:8, background:"white", border:"2px solid #e2e4ef", cursor:"pointer", transition:"all 0.15s", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, color:"#1a1a2e", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#6366f1"; e.currentTarget.style.background="#f0f1ff"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#e2e4ef"; e.currentTarget.style.background="white"; }}>
                {party}<span style={{ fontSize:16, color:"#6366f1" }}>+</span>
              </div>
            ))}
        </div>
      </div>
      <div style={{ flex:"1 1 220px" }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, color:"#6366f1", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Votre classement ({ranking.length}/{PARTIES.length})</p>
        <div style={{ minHeight:60, background:"#f0f1ff", borderRadius:10, padding:8 }}>
          {ranking.length === 0
            ? <p style={{ fontSize:13, color:"#b0b3c8", fontFamily:"'DM Sans',sans-serif", textAlign:"center", padding:"12px 0" }}>Cliquez sur un parti pour commencer</p>
            : ranking.map((party, i) => (
              <div key={party} draggable
                onDragStart={e => onDragStartRanked(e, i)} onDragOver={e => onDragOverRanked(e, i)} onDrop={() => onDropRanked(i)} onDragEnd={() => { setDragSrc(null); setOverRanked(null); }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", marginBottom:6, borderRadius:8, background:overRanked===i?"#e0e1ff":"white", border:`2px solid ${overRanked===i?"#6366f1":"#c7c9f0"}`, cursor:"grab", transition:"all 0.15s", boxShadow:"0 1px 4px rgba(99,102,241,0.1)" }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#6366f1", fontWeight:700, minWidth:20 }}>{i+1}</span>
                <span style={{ fontSize:14 }}>⠿</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, color:"#1a1a2e", flex:1 }}>{party}</span>
                <button onClick={() => removeFromRanking(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#c0c3d8", fontSize:16, padding:"0 2px" }}>×</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Coalition Choice ─────────────────────────────────────────────────────────
function CoalitionChoice({ question, optionA, optionB, value, onChange }) {
  return (
    <div style={{ marginBottom:32 }}>
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, color:"#1a1a2e", marginBottom:12 }}>{question}</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {[optionA, optionB].map((opt, idx) => (
          <button key={idx} onClick={() => onChange(idx===0?"A":"B")}
            style={{ padding:"14px 22px", borderRadius:10, border:`2px solid ${value===(idx===0?"A":"B")?"#6366f1":"#dde0ef"}`, background:value===(idx===0?"A":"B")?"linear-gradient(135deg,#6366f1,#818cf8)":"white", color:value===(idx===0?"A":"B")?"white":"#1a1a2e", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, cursor:"pointer", transition:"all 0.2s", boxShadow:value===(idx===0?"A":"B")?"0 4px 16px rgba(99,102,241,0.3)":"none" }}>
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
    <div style={{ width:"100%", height:4, background:"#e2e4ef", borderRadius:2, marginBottom:32 }}>
      <div style={{ height:"100%", width:`${(step/total)*100}%`, background:"linear-gradient(90deg,#6366f1,#a78bfa)", borderRadius:2, transition:"width 0.4s ease" }} />
    </div>
  );
}

// ─── Admin View ───────────────────────────────────────────────────────────────
function AdminView({ onBack }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  useEffect(() => { loadResponses().then(r => { setResponses(r); setLoading(false); }); }, []);
  const downloadCSV = () => {
    if (!responses.length) return;
    const cols = ["id","submittedAt","age","background","lastVote","lastVoteOther","familiarite","ranking","approvals","coal_attention","coal_1","coal_2","coal_3","coal_4","coal_A","coal_B","coal_5","coal_C","feedback"];
    const rows = responses.map(r => cols.map(c => { const v=r[c]; if(typeof v==="object") return JSON.stringify(v); return `"${String(v||"").replace(/"/g,'""')}"`; }).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="thesis_responses_fr.csv"; a.click();
  };
  if (loading) return <div style={{ padding:40, textAlign:"center", color:"#6366f1" }}>Chargement...</div>;
  return (
    <div style={{ minHeight:"100vh", background:"#f4f5fb", padding:"40px 20px" }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, color:"#1a1a2e", margin:0 }}>📊 Réponses (FR)</h1>
            <p style={{ color:"#8b8fa8", margin:"4px 0 0", fontFamily:"'DM Sans',sans-serif" }}>{responses.length} réponses</p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={downloadCSV} style={{ padding:"10px 20px", borderRadius:8, border:"none", background:"#6366f1", color:"white", fontFamily:"'DM Sans',sans-serif", fontWeight:600, cursor:"pointer" }}>⬇ Télécharger CSV</button>
            <button onClick={onBack} style={{ padding:"10px 20px", borderRadius:8, border:"2px solid #dde0ef", background:"white", fontFamily:"'DM Sans',sans-serif", fontWeight:600, cursor:"pointer", color:"#1a1a2e" }}>← Retour</button>
          </div>
        </div>
        {responses.length === 0
          ? <div style={{ textAlign:"center", padding:60, background:"white", borderRadius:16, color:"#8b8fa8", fontFamily:"'DM Sans',sans-serif" }}>Aucune réponse pour l'instant.</div>
          : responses.map((r, i) => (
            <div key={r.id} onClick={() => setSelected(selected===i?null:i)}
              style={{ background:"white", borderRadius:12, padding:20, marginBottom:12, cursor:"pointer", border:"2px solid", borderColor:selected===i?"#6366f1":"transparent", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, color:"#1a1a2e" }}>Répondant #{i+1}</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#8b8fa8" }}>{new Date(r.submittedAt).toLocaleString("fr-FR")}</span>
              </div>
              <div style={{ marginTop:4, fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#6366f1" }}>
                {r.age} ans · {r.background} · A voté : {r.lastVote}{r.lastVoteOther?` (${r.lastVoteOther})`:""}
              </div>
              {selected===i && (
                <div style={{ marginTop:16, borderTop:"1px solid #eee", paddingTop:16 }}>
                  <div style={{ marginBottom:12 }}>
                    <strong style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#8b8fa8" }}>FAMILIARITÉ</strong>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                      {Object.entries(r.familiarite||{}).map(([p,v]) => (
                        <span key={p} style={{ padding:"3px 10px", borderRadius:20, fontSize:12, fontFamily:"'DM Sans',sans-serif", fontWeight:600, background:v==="oui"?"#dcfce7":"#fee2e2", color:v==="oui"?"#16a34a":"#dc2626" }}>{p}: {v}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                    <div>
                      <strong style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#8b8fa8" }}>CLASSEMENT</strong>
                      <ol style={{ margin:"8px 0 0", paddingLeft:20, fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>
                        {(r.ranking||[]).map((p,j) => <li key={j}>{p}</li>)}
                      </ol>
                    </div>
                    <div>
                      <strong style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#8b8fa8" }}>APPROBATIONS</strong>
                      <div style={{ marginTop:8 }}>
                        {Object.entries(r.approvals||{}).map(([p,v]) => (
                          <div key={p} style={{ fontFamily:"'DM Mono',monospace", fontSize:13, display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span>{p}</span><span style={{ color:v>0?"#16a34a":v<0?"#dc2626":"#8b8fa8" }}>{v>0?`+${v}`:v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop:16 }}>
                    <strong style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#8b8fa8" }}>CHOIX DE COALITION</strong>
                    {[["V0: {1,2} vs {3,4}","coal_attention"],["V1: {1} vs {2,3,4}","coal_1"],["V2: {1,2,3} vs {1,2}","coal_2"],["V3: {1,8} vs {4,5}","coal_3"],["V4: {1,3,8} vs {3,4,5}","coal_4"],["V5: {1,3} vs {2}","coal_A"],["V6: {1,3,5} vs {2,4,5}","coal_B"],["V7: influence A","coal_5"],["V8: influence B","coal_C"]].map(([lbl,key]) => (
                      <div key={key} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, marginTop:6 }}>
                        <span style={{ color:"#8b8fa8" }}>{lbl}:</span> {r[key]||"—"}
                      </div>
                    ))}
                  </div>
                  {r.feedback && <div style={{ marginTop:16, background:"#f4f5fb", borderRadius:8, padding:12 }}>
                    <strong style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#8b8fa8" }}>COMMENTAIRES</strong>
                    <p style={{ margin:"6px 0 0", fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>{r.feedback}</p>
                  </div>}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Ideal Coalition Page ────────────────────────────────────────────────────

const PARTY_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];

function PieChart({ slices }) {
  const size = 220, cx = size/2, cy = size/2, r = 90, inner = 44;
  let cumAngle = -Math.PI/2;
  const paths = slices.map(({ pct, color }, i) => {
    if (pct <= 0) return null;
    const angle = (pct/100)*2*Math.PI;
    const x1=cx+r*Math.cos(cumAngle), y1=cy+r*Math.sin(cumAngle);
    cumAngle += angle;
    const x2=cx+r*Math.cos(cumAngle), y2=cy+r*Math.sin(cumAngle);
    const xi1=cx+inner*Math.cos(cumAngle-angle), yi1=cy+inner*Math.sin(cumAngle-angle);
    const xi2=cx+inner*Math.cos(cumAngle), yi2=cy+inner*Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return <path key={i} d={`M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`} fill={color} stroke="white" strokeWidth="2" />;
  });
  const total = slices.reduce((s,sl) => s+sl.pct, 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {total===0 ? <circle cx={cx} cy={cy} r={r} fill="#e2e4ef" /> : paths}
      <circle cx={cx} cy={cy} r={inner} fill="white" />
      <text x={cx} y={cy-6} textAnchor="middle" fontSize="13" fontFamily="'DM Sans',sans-serif" fill="#1a1a2e" fontWeight="700">{Math.round(total)}%</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize="10" fontFamily="'DM Sans',sans-serif" fill="#8b8fa8">alloué</text>
    </svg>
  );
}

function IdealCoalitionPage({ parties, idealCoalition, setIdealCoalition, onBack, onNext, btnStyle }) {
  const selected = Object.keys(idealCoalition);
  const total = selected.reduce((s,p) => s+(idealCoalition[p]||0), 0);
  const remaining = Math.max(0, 100-total);

  const toggleParty = (party) => {
    if (idealCoalition[party] !== undefined) {
      const next = {...idealCoalition}; delete next[party]; setIdealCoalition(next);
    } else {
      setIdealCoalition(prev => ({...prev,[party]:0}));
    }
  };
  const setPercent = (party, val) => {
    setIdealCoalition(prev => ({...prev,[party]:Math.max(0,Math.min(100,Number(val)))}));
  };
  const distribute = () => {
    const keys = Object.keys(idealCoalition); if(!keys.length) return;
    const each = Math.floor(100/keys.length), rem = 100-each*keys.length;
    const next = {}; keys.forEach((k,i) => { next[k]=each+(i===0?rem:0); }); setIdealCoalition(next);
  };
  const slices = parties.filter(p => idealCoalition[p]!==undefined && idealCoalition[p]>0).map(p => ({ pct:idealCoalition[p], color:PARTY_COLORS[parties.indexOf(p)%PARTY_COLORS.length] }));

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#1a1a2e", marginTop:0 }}>Votre Coalition Idéale</h2>
      <p style={{ color:"#8b8fa8", fontSize:14, lineHeight:1.6, marginBottom:20 }}>Quels partis aimeriez-vous voir dans une coalition gouvernementale idéale ? Sélectionnez les partis et attribuez un pourcentage d'influence à chacun. Le total doit être égal à 100%.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
        {parties.map((party, i) => {
          const isSelected = idealCoalition[party] !== undefined;
          const color = PARTY_COLORS[i%PARTY_COLORS.length];
          return (
            <div key={party} style={{ borderRadius:10, border:`2px solid ${isSelected?color:"#e2e4ef"}`, background:isSelected?"#fafafe":"white", overflow:"hidden", transition:"all 0.2s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", cursor:"pointer" }} onClick={() => toggleParty(party)}>
                <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${isSelected?color:"#d0d3e8"}`, background:isSelected?color:"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s" }}>
                  {isSelected && <span style={{ color:"white", fontSize:11, fontWeight:900 }}>✓</span>}
                </div>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, color:"#1a1a2e", flex:1 }}>{party}</span>
                {isSelected && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color }}>{idealCoalition[party]}%</span>}
              </div>
              {isSelected && (
                <div style={{ padding:"0 16px 14px" }}>
                  <input type="range" min="0" max="100" value={idealCoalition[party]} onChange={e => setPercent(party, e.target.value)} style={{ width:"100%", accentColor:color, cursor:"pointer" }} />
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#b0b3c8", fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, marginBottom:24 }}>
          <PieChart slices={slices} />
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
            {parties.filter(p => idealCoalition[p]!==undefined).map(p => (
              <span key={p} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontFamily:"'DM Sans',sans-serif", fontWeight:600, color:"#1a1a2e" }}>
                <span style={{ width:10, height:10, borderRadius:2, background:PARTY_COLORS[parties.indexOf(p)%PARTY_COLORS.length], display:"inline-block" }} />
                {p} ({idealCoalition[p]}%)
              </span>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:total===100?"#16a34a":total>100?"#dc2626":"#f59e0b" }}>
              Total : {Math.round(total)}% {total===100?"✓":total>100?"— trop élevé !":`— encore ${Math.round(remaining)}% à allouer`}
            </span>
            <button onClick={distribute} style={{ padding:"6px 14px", borderRadius:8, border:"2px solid #6366f1", background:"white", color:"#6366f1", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:12, cursor:"pointer" }}>
              Répartir équitablement
            </button>
          </div>
        </div>
      )}
      <div style={{ display:"flex", gap:12, marginTop:8 }}>
        <button onClick={onBack} style={{ ...btnStyle(false), background:"white", color:"#6366f1", border:"2px solid #6366f1", boxShadow:"none" }}>← Retour</button>
        <button onClick={onNext} style={btnStyle(false)}>Suivant →</button>
      </div>
      <p style={{ fontSize:12, color:"#b0b3c8", marginTop:8, fontFamily:"'DM Sans',sans-serif" }}>Cette question est optionnelle — vous pouvez continuer sans sélectionner de partis.</p>
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
  const [lastVoteOther, setLastVoteOther] = useState("");
  const [voteCommentaire, setVoteCommentaire] = useState("");
  const [consented, setConsented] = useState(false);
  const [familiarite, setFamiliarite] = useState({});
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
  const [coalD, setCoalD] = useState(""); // {1, c} vs {2, 3}
  const [coalE, setCoalE] = useState(""); // {1: 70%, c: 30%} vs {2: 50%, 3: 50%}
  const [idealCoalition, setIdealCoalition] = useState({});
  const [feedback, setFeedback] = useState("");

  const r = ranking;

  // c = party with approval score closest to 0 from below (least negative)
  // fallback: if no party has negative approval, use r[7] (last ranked)
  const c = (() => {
    const negParties = PARTIES.filter(p => approvals[p] < 0);
    if (negParties.length === 0) return r[7] || "";
    return negParties.reduce((best, p) =>
      approvals[p] > approvals[best] ? p : best
    , negParties[0]);
  })();

  const handleSubmit = async () => {
    setSaving(true);
    await saveResponse({ age, background, lastVote, lastVoteOther, voteCommentaire, familiarite, ranking, approvals, c_party: c, coal_attention:coal0, coal_1:coal1, coal_2:coal2, coal_3:coal3, coal_4:coal4, coal_A:coalA, coal_B:coalB, coal_5:coal5, coal_C:coalC, coal_D:coalD, coal_E:coalE, idealCoalition, feedback });
    setSaving(false);
    setPage(6);
  };

  const btnStyle = (disabled) => ({ padding:"14px 32px", borderRadius:10, border:"none", background:disabled?"#dde0ef":"linear-gradient(135deg,#6366f1,#818cf8)", color:disabled?"#a0a3b8":"white", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, cursor:disabled?"not-allowed":"pointer", boxShadow:disabled?"none":"0 4px 16px rgba(99,102,241,0.3)", transition:"all 0.2s" });
  const inputStyle = { padding:"12px 16px", borderRadius:8, border:"2px solid #e2e4ef", fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#1a1a2e", background:"white", width:"100%", outline:"none", boxSizing:"border-box" };
  const container = { minHeight:"100vh", background:"linear-gradient(160deg,#f0f1ff 0%,#fafafa 50%,#f0f4ff 100%)", display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px", fontFamily:"'DM Sans',sans-serif" };
  const card = { background:"white", borderRadius:20, padding:"40px 44px", maxWidth:640, width:"100%", boxShadow:"0 8px 40px rgba(99,102,241,0.1),0 1px 8px rgba(0,0,0,0.04)" };
  const label = { display:"block", fontWeight:700, fontSize:13, color:"#6366f1", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10, marginTop:24 };
  const choiceBtn = (active, danger) => ({ padding:"9px 18px", borderRadius:8, border:`2px solid ${active?(danger?"#e55":"#6366f1"):"#e2e4ef"}`, background:active?(danger?"#fee2e2":"linear-gradient(135deg,#6366f1,#818cf8)"):"white", color:active?(danger?"#dc2626":"white"):"#1a1a2e", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, cursor:"pointer", transition:"all 0.15s" });

  if (adminMode) return <AdminView onBack={() => setAdminMode(false)} />;

  const familiariteComplete = PARTIES.every(p => familiarite[p]);

  return (
    <div style={container}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600;700&family=DM+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth:640, width:"100%", marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:"#1a1a2e", margin:0, letterSpacing:"-0.02em" }}>Étude sur les Préférences de Coalition</h1>
          <p style={{ color:"#8b8fa8", margin:"4px 0 0", fontSize:13 }}>Mémoire de Licence · Intelligence Artificielle</p>
        </div>
        <button onClick={() => setShowAdminLogin(v => !v)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, opacity:0.4 }}>🔒</button>
      </div>

      {showAdminLogin && (
        <div style={{ maxWidth:640, width:"100%", marginBottom:16, background:"white", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.08)", display:"flex", gap:10 }}>
          <input placeholder="Mot de passe admin" type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)} style={{ ...inputStyle, flex:1 }} />
          <button onClick={() => { if(adminInput==="thesis2025"){setAdminMode(true);setShowAdminLogin(false);}else alert("Mot de passe incorrect"); }} style={{ ...btnStyle(false), padding:"12px 20px", fontSize:14 }}>Connexion</button>
        </div>
      )}

      <div style={card}>
        {page < 7 && <ProgressBar step={page} total={6} />}

        {/* PAGE 0 — Consent */}
        {page === 0 && (
          <div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#1a1a2e", marginTop:0 }}>Bonjour ! 👋</h2>
            <div style={{ background:"linear-gradient(135deg,#f0f1ff,#f8f0ff)", borderRadius:14, padding:24, marginBottom:24 }}>
              <p style={{ fontSize:15, lineHeight:1.75, color:"#1a1a2e", margin:0 }}>
                Je m'appelle Jade et dans le cadre de ma licence en Intelligence Artificielle à l'Université d'Amsterdam, j'écris un mémoire sur l'agrégation de préférences et le lien entre les préférences sur les partis politiques et les préférences sur les coalitions de gouvernement. Je collecte pour ce mémoire des données pour tester et évaluer différentes méthodes et règles de formation de coalitions. Votre participation m'aide énormément!
              </p>
              <p style={{ fontSize:15, lineHeight:1.75, color:"#1a1a2e", margin:"12px 0 0" }}>⏱️ Participer ne prend que <strong>5 minutes environ</strong>.</p>
              <p style={{ fontSize:15, lineHeight:1.75, color:"#1a1a2e", margin:"12px 0 0" }}>🔒 <strong>Toutes vos réponses restent totalement anonymes</strong> et seront utilisées uniquement dans le cadre de mon mémoire de licence.</p>
            </div>
            <div onClick={() => setConsented(v => !v)} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"16px 20px", borderRadius:10, border:`2px solid ${consented?"#6366f1":"#e2e4ef"}`, background:consented?"#f0f1ff":"white", cursor:"pointer", transition:"all 0.2s" }}>
              <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${consented?"#6366f1":"#d0d3e8"}`, background:consented?"#6366f1":"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s" }}>
                {consented && <span style={{ color:"white", fontSize:14, fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ fontSize:14, fontWeight:600, color:"#1a1a2e", lineHeight:1.5 }}>J'accepte les informations ci-dessus et je donne mon consentement pour l'utilisation anonyme de mes réponses dans le cadre de cette étude.</span>
            </div>
            <p style={{ fontSize:15, color:"#8b8fa8", marginTop:20, fontStyle:"italic" }}>Merci d'avance pour votre participation ! 🙏</p>
            <div style={{ marginTop:24 }}>
              <button disabled={!consented} onClick={() => setPage(1)} style={btnStyle(!consented)}>Continuer →</button>
            </div>
          </div>
        )}

        {/* PAGE 1 — Personal */}
        {page === 1 && (
          <div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#1a1a2e", marginTop:0 }}>Questions Personnelles</h2>
            <p style={{ color:"#8b8fa8", fontSize:14, lineHeight:1.6, marginBottom:24 }}>Partie 1 sur 4 · Veuillez répondre aux questions suivantes.</p>

            <label style={label}>1. Quel est votre âge ?</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {["<18","18-20","21-25","26-30","31-40","40+","Préfère ne pas répondre"].map(a => (
                <button key={a} onClick={() => setAge(a)} style={choiceBtn(age===a)}>{a}</button>
              ))}
            </div>

            <label style={label}>2. Quel est votre <strong>dernier</strong> niveau d'étude ?</label>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {["Lycée","BTS / DUT","Licence","Master","Doctorat","Préfère ne pas répondre"].map(a => (
                <button key={a} onClick={() => setBackground(a)} style={{ ...choiceBtn(background===a), textAlign:"left" }}>{a}</button>
              ))}
            </div>

            <label style={label}>3. Pour quel parti avez-vous voté lors des dernières élections nationales ?</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
              {FR_VOTE_OPTIONS.map(a => (
                <button key={a} onClick={() => { setLastVote(a); if(a!=="Autre") setLastVoteOther(""); }} style={choiceBtn(lastVote===a)}>{a}</button>
              ))}
            </div>
            {lastVote === "Autre" && (
              <input style={inputStyle} placeholder="Précisez..." value={lastVoteOther} onChange={e => setLastVoteOther(e.target.value)} />
            )}

            <div style={{ display:"flex", gap:12, marginTop:32 }}>
              <button onClick={() => setPage(0)} style={{ ...btnStyle(false), background:"white", color:"#6366f1", border:"2px solid #6366f1", boxShadow:"none" }}>← Retour</button>
              <button disabled={!age||!background||!lastVote||(lastVote==="Autre"&&!lastVoteOther.trim())} onClick={() => setPage(2)} style={btnStyle(!age||!background||!lastVote||(lastVote==="Autre"&&!lastVoteOther.trim()))}>Suivant →</button>
            </div>
          </div>
        )}

        {/* PAGE 2 — Ranking + Approval */}
        {page === 2 && (
          <div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#1a1a2e", marginTop:0 }}>Vos Préférences</h2>
            <p style={{ color:"#8b8fa8", fontSize:14, lineHeight:1.6, marginBottom:8 }}>Partie 2 sur 4 · Pour cette expérience, j'ai selectionné 8 grands partis de France.</p>

            <label style={label}>1. Quel est votre classement des partis proposés ?</label>
            <p style={{ color:"#8b8fa8", fontSize:13, marginBottom:12 }}>Cliquez sur un parti pour l'ajouter à votre classement. Faites ensuite glisser pour ajuster l'ordre. Vous devez classer tous les partis pour continuer.</p>
            <RankingList ranking={ranking} setRanking={setRanking} pool={pool} setPool={setPool} />

            <label style={{ ...label, marginTop:36 }}>2. Quel est votre niveau d'approbation de ces partis ?</label>
            <p style={{ color:"#8b8fa8", fontSize:13, marginBottom:20 }}><strong>−5</strong> = je ne voudrais vraiment pas ce parti dans une coalition gouvernementale &nbsp;·&nbsp; <strong>0</strong> = neutre &nbsp;·&nbsp; <strong>+5</strong> = je voudrais vraiment ce parti dans la coalition</p>
            <div style={{ marginBottom:32 }}>
              {PARTIES.map(p => <ApprovalSlider key={p} party={p} value={approvals[p]} onChange={v => setApprovals(prev => ({...prev,[p]:v}))} />)}
            </div>

            <div style={{ display:"flex", gap:12, marginTop:16 }}>
              <button onClick={() => setPage(1)} style={{ ...btnStyle(false), background:"white", color:"#6366f1", border:"2px solid #6366f1", boxShadow:"none" }}>← Retour</button>
              <button disabled={ranking.length < PARTIES.length} onClick={() => setPage(3)} style={btnStyle(ranking.length < PARTIES.length)}>Suivant →</button>
            </div>
          </div>
        )}

        {/* PAGE 3 — Coalition Comparisons */}
        {page === 3 && (
          <div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#1a1a2e", marginTop:0 }}>Comparaisons de Coalitions</h2>
            <p style={{ color:"#8b8fa8", fontSize:14, lineHeight:1.6, marginBottom:8 }}>Voici un rappel de votre classement :</p>
            <div style={{ background:"#f4f5fb", borderRadius:10, padding:"10px 14px", marginBottom:24, fontSize:13, color:"#6366f1", fontFamily:"'DM Mono',monospace" }}>
              1={r[0]} · 2={r[1]} · 3={r[2]} · 4={r[3]} · 5={r[4]} · 6={r[5]} · 7={r[6]} · 8={r[7]}
            </div>
            <p style={{ fontWeight:700, fontSize:15, color:"#1a1a2e", marginBottom:20 }}>Quel ensemble de partis préféreriez-vous dans la coalition ?</p>

            <CoalitionChoice question={`Question 0 : {${r[0]}, ${r[1]}} ou {${r[2]}, ${r[3]}} ?`} optionA={`{${r[0]}, ${r[1]}}`} optionB={`{${r[2]}, ${r[3]}}`} value={coal0} onChange={setCoal0} />
            <div style={{ borderTop:"1px solid #eee", paddingTop:20, marginTop:4 }}>
              <CoalitionChoice question={`Question 1 : {${r[0]}} ou {${r[1]}, ${r[2]}, ${r[3]}} ?`} optionA={`{${r[0]}}`} optionB={`{${r[1]}, ${r[2]}, ${r[3]}}`} value={coal1} onChange={setCoal1} />
              <CoalitionChoice question={`Question 2 : {${r[0]}, ${r[1]}, ${r[2]}} ou {${r[0]}, ${r[1]}} ?`} optionA={`{${r[0]}, ${r[1]}, ${r[2]}}`} optionB={`{${r[0]}, ${r[1]}}`} value={coal2} onChange={setCoal2} />
              <CoalitionChoice question={`Question 3 : {${r[0]}, ${r[2]}} ou {${r[1]}} ?`} optionA={`{${r[0]}, ${r[2]}}`} optionB={`{${r[1]}}`} value={coalA} onChange={setCoalA} />
              <CoalitionChoice question={`Question 4 : {${r[0]}, ${r[7]}} ou {${r[3]}, ${r[4]}} ?`} optionA={`{${r[0]}, ${r[7]}}`} optionB={`{${r[3]}, ${r[4]}}`} value={coal3} onChange={setCoal3} />
              <CoalitionChoice question={`Question 5 : {${r[0]}, ${r[2]}, ${r[7]}} ou {${r[2]}, ${r[3]}, ${r[4]}} ?`} optionA={`{${r[0]}, ${r[2]}, ${r[7]}}`} optionB={`{${r[2]}, ${r[3]}, ${r[4]}}`} value={coal4} onChange={setCoal4} />
              <CoalitionChoice question={`Question 6 : {${r[0]}, ${r[2]}, ${r[4]}} ou {${r[1]}, ${r[4]}} ?`} optionA={`{${r[0]}, ${r[2]}, ${r[4]}}`} optionB={`{${r[1]}, ${r[4]}}`} value={coalB} onChange={setCoalB} />
            </div>
            <div style={{ borderTop:"1px solid #eee", paddingTop:24, marginTop:8 }}>
              <p style={{ fontSize:14, color:"#8b8fa8", marginBottom:16 }}>Les questions suivantes tiennent également compte de <strong>l'influence des partis</strong> dans la coalition :</p>
              <CoalitionChoice question={`Question 7 : {${r[0]} (20%), ${r[2]} (80%)} ou {${r[0]} (60%), ${r[5]} (40%)} ?`} optionA={`{${r[0]}: 20%, ${r[2]}: 80%}`} optionB={`{${r[0]}: 60%, ${r[5]}: 40%}`} value={coal5} onChange={setCoal5} />
              <CoalitionChoice question={`Question 8 : {${r[0]}: 90%, ${r[1]}: 10%} ou {${r[0]}: 50%, ${r[1]}: 50%} ?`} optionA={`{${r[0]}: 90%, ${r[1]}: 10%}`} optionB={`{${r[0]}: 50%, ${r[1]}: 50%}`} value={coalC} onChange={setCoalC} />
            </div>

            {c && (
              <div style={{ borderTop:"1px solid #eee", paddingTop:24, marginTop:8 }}>
                <CoalitionChoice
                  question={`Question 9 : {${r[0]}: 70%, ${c}: 30%} ou {${r[1]}: 50%, ${r[2]}: 50%} ?`}
                  optionA={`{${r[0]}: 70%, ${c}: 30%}`}
                  optionB={`{${r[1]}: 50%, ${r[2]}: 50%}`}
                  value={coalE} onChange={setCoalE}
                />
              </div>
            )}

            <div style={{ display:"flex", gap:12, marginTop:24 }}>
              <button onClick={() => setPage(2)} style={{ ...btnStyle(false), background:"white", color:"#6366f1", border:"2px solid #6366f1", boxShadow:"none" }}>← Retour</button>
              <button disabled={!coal0||!coal1||!coal2||!coal3||!coal4||!coalA||!coalB||!coal5||!coalC||!coalE} onClick={() => setPage(4)} style={btnStyle(!coal0||!coal1||!coal2||!coal3||!coal4||!coalA||!coalB||!coal5||!coalC||!coalE)}>Suivant →</button>
            </div>
          </div>
        )}
        
        {/* PAGE 4 — Ideal Coalition */}
        {page === 4 && (
          <IdealCoalitionPage
            parties={PARTIES}
            idealCoalition={idealCoalition}
            setIdealCoalition={setIdealCoalition}
            onBack={() => setPage(3)}
            onNext={() => setPage(5)}
            btnStyle={btnStyle}
          />
        )}

        {/* PAGE 5 — Feedback */}
        {page === 5 && (
          <div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#1a1a2e", marginTop:0 }}>Questions ou Commentaires ?</h2>
            <p style={{ color:"#8b8fa8", fontSize:14, lineHeight:1.6, marginBottom:24 }}>Avez-vous des questions, remarques ou commentaires sur cette étude ? N'hésitez pas à les laisser ci-dessous. C'est entièrement optionnel.</p>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Vous pouvez répondre librement ici..." style={{ ...inputStyle, minHeight:140, resize:"vertical", lineHeight:1.6 }} />
            <p style={{ fontSize:14, color:"#8b8fa8", marginTop:20 }}>Merci beaucoup d'avoir rempli ce questionnaire ! 🎉</p>
            <div style={{ display:"flex", gap:12, marginTop:24 }}>
              <button onClick={() => setPage(4)} style={{ ...btnStyle(false), background:"white", color:"#6366f1", border:"2px solid #6366f1", boxShadow:"none" }}>← Retour</button>
              <button onClick={handleSubmit} disabled={saving} style={btnStyle(saving)}>{saving?"Enregistrement...":"Envoyer mes réponses 🚀"}</button>
            </div>
          </div>
        )}

        {/* PAGE 6 — Done */}
        {page === 6 && (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🎓</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:"#1a1a2e" }}>Merci !</h2>
            <p style={{ color:"#8b8fa8", fontSize:15, lineHeight:1.75 }}>Vos réponses ont été enregistrées de manière anonyme et seront utilisées dans le cadre de mon mémoire de licence sur la faisabilité des coalitions.<br /><br />Merci beaucoup pour votre précieuse participation ! 🙏</p>
            <div style={{ marginTop:24, padding:"16px 20px", background:"#f0f1ff", borderRadius:10, fontSize:14, color:"#6366f1", fontWeight:600 }}>Vous pouvez fermer cet onglet.</div>
          </div>
        )}
      </div>
      <p style={{ marginTop:20, fontSize:12, color:"#c0c3d8" }}>Mémoire de Licence · Toutes les données sont traitées de manière anonyme</p>
    </div>
  );
}
