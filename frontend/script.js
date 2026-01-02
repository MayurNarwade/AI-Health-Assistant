// -------------------------------
// script.js - Updated frontend logic (full file)
// -------------------------------

/* --------- Config --------- */
const BACKEND_JSON_URL = "http://127.0.0.1:8000/predict"; // Try POST JSON first
const BACKEND_GET_URL = "http://127.0.0.1:8000/predict";  // fallback GET
const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const NEARBY_RADIUS = 5000; // meters
const MAX_DOCTORS = 10;

let recognition = null;
let recording = false;
let userLocation = null;
let lang = "en";

/* --------- i18n --------- */
const L = {
    en: {
        tip_loc: "Tip: Allow location access to find nearby doctors. Uses free OpenStreetMap data.",
        analyzing: "⏳ Analyzing…",
        no_input: "⚠ Please enter symptoms!",
        server_err: "❌ Server Error:",
        network_err: "❌ Network Error:",
        no_predictions: "No disease found. Try adding more details.",
        nearby_title: "Nearby doctors (from OpenStreetMap)",
        loc_denied: "Location access denied or unavailable. Doctor search disabled.",
        voice_on: "🔴 Listening... click to stop",
        voice_off: "🎤 Speak",
        triage_REASONS: "Triage reasons",
        danger_level: "Danger level",
        top_symptoms: "Top matching symptoms",
        possible_diseases: "Possible diseases based on your symptoms",
        suggested_tests: "Suggested Tests",
        specialists: "Specialists",
        triage_ref: "Triage mapping (reference)",
        disclaimer: "Disclaimer: Informational only; not a medical diagnosis.",
        recurring: "RECURRING"
    },
    hi: {
        tip_loc: "टिप: पास के डॉक्टर खोजने के लिए लोकेशन की अनुमति दें। (OpenStreetMap का उपयोग करता है)",
        analyzing: "⏳ विश्लेषण किया जा रहा है…",
        no_input: "⚠ कृपया लक्षण दर्ज करें!",
        server_err: "❌ सर्वर त्रुटि:",
        network_err: "❌ नेटवर्क त्रुटि:",
        no_predictions: "कोई बीमारी नहीं मिली। और विवरण देने की कोशिश करें।",
        nearby_title: "पास के डॉक्टर (OpenStreetMap से)",
        loc_denied: "लोकेशन अनुमति अस्वीकृत। डॉक्टर खोज अक्षम।",
        voice_on: "🔴 सुन रहा है... रोकने के लिए क्लिक करें",
        voice_off: "🎤 बोलें",
        triage_REASONS: "ट्रायज कारण",
        danger_level: "खतरे का स्तर",
        top_symptoms: "शीर्ष मिलान लक्षण",
        possible_diseases: "आपके लक्षणों के आधार पर संभावित बीमारियां",
        suggested_tests: "सुझाए गए परीक्षण",
        specialists: "विशेषज्ञ",
        triage_ref: "ट्रायज मैपिंग (संदर्भ)",
        disclaimer: "अस्वीकरण: केवल सूचना के लिए; कोई चिकित्सा निदान नहीं।",
        recurring: "आवर्ती",
        // Common symptoms/diseases
        "fever": "बुखार",
        "headache": "सिरदर्द",
        "cough": "खांसी",
        "vomiting": "उल्टी",
        "nausea": "जी मिचलाना",
        "dizziness": "चक्कर आना",
        "migraine": "माइग्रेन",
        "influenza": "इन्फ्लुएंजा",
        "pneumonia": "निमोनिया",
        "malaria": "मलेरिया",
        "typhoid": "टाइफाइड",
        "dengue": "डेंगू",
        "chest pain": "सीने में दर्द",
        "shortness of breath": "सांस की तकलीफ"
    },
    mr: {
        tip_loc: "टीप: जवळील डॉक्टर शोधण्यासाठी स्थान प्रवेश द्या. (OpenStreetMap वापरते)",
        analyzing: "⏳ विश्लेषण चालू आहे…",
        no_input: "⚠ कृपया लक्षणे प्रविष्ट करा!",
        server_err: "❌ सर्व्हर त्रुटी:",
        network_err: "❌ नेटवर्क त्रुटी:",
        no_predictions: "कोणतीही आजार सापडली नाही. अधिक तपशील देऊन प्रयत्न करा.",
        nearby_title: "जवळील डॉक्टर (OpenStreetMap द्वारे)",
        loc_denied: "स्थान प्रवेश नाकारला. डॉक्टर शोध अक्षम.",
        voice_on: "🔴 ऐकत आहे... थांबवण्यासाठी क्लिक करा",
        voice_off: "🎤 बोला",
        triage_REASONS: "त्रायज कारणे",
        danger_level: "धोक्याची पातळी",
        top_symptoms: "शीर्ष जुळणारी लक्षणे",
        possible_diseases: "तुमच्या लक्षणांवर आधारित संभाव्य आजार",
        suggested_tests: "सुचवलेल्या चाचण्या",
        specialists: "तज्ञ",
        triage_ref: "त्रायज मॅपिंग (संदर्भ)",
        disclaimer: "अस्वीकरण: केवळ माहितीसाठी; वैद्यकीय निदान नाही.",
        recurring: "आवर्ती",
        // Common symptoms/diseases
        "fever": "ताप",
        "headache": "डोकेदुखी",
        "cough": "खोकला",
        "vomiting": "उलट्या",
        "nausea": "मळमळ",
        "dizziness": "चक्कर येणे",
        "migraine": "मायग्रेन",
        "influenza": "इन्फ्लुएंजा",
        "pneumonia": "न्यूमोनिया",
        "malaria": "ताप (मलेरिया)",
        "typhoid": "टायफॉइड",
        "dengue": "डेंग्यू",
        "chest pain": "छातीत दुखणे",
        "shortness of breath": "श्वास घेण्यास त्रास"
    }
};

function t(key) {
    if (!key) return "";
    const lowerKey = key.toLowerCase();
    return (L[lang] && L[lang][lowerKey]) ? L[lang][lowerKey] :
        (L[lang] && L[lang][key]) ? L[lang][key] :
            (L["en"][lowerKey]) ? L["en"][lowerKey] :
                (L["en"][key]) ? L["en"][key] : key;
}

// Helper: find an element by a list of possible ids (fallbacks)
function getElByIds(ids) {
    for (let id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}

// Better: prefer input/textarea elements and return inner inputs when passed a container
function getInputElByIds(ids) {
    for (let id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || typeof el.value !== 'undefined') return el;
        // try to find an input/textarea inside the container
        if (el.querySelector) {
            const inner = el.querySelector('textarea, input');
            if (inner) return inner;
        }
        // fallback to element itself
        return el;
    }
    return null;
}

/* --------- UI language updates --------- */
function changeLanguage() {
    lang = document.getElementById("langSelect") ? document.getElementById("langSelect").value : "en";
    const labels = {
        en: "Describe your symptoms here…",
        hi: "यहाँ अपने लक्षण बताइए…",
        mr: "येथे आपली लक्षणे वर्णन करा…"
    };
    if (document.getElementById("symLabel")) document.getElementById("symLabel").innerText = labels[lang] || labels.en;
    if (document.getElementById("nearbyTitle")) document.getElementById("nearbyTitle").innerText = t("nearby_title");
    if (document.getElementById("status")) document.getElementById("status").innerText = "";
    if (document.getElementById("voiceBtn")) document.getElementById("voiceBtn").innerText = t("voice_off");
}

/* --------- Voice recognition (toggle) --------- */
function toggleVoice() {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        alert("Speech Recognition not supported in this browser. Use Chrome on desktop or Android.");
        return;
    }
    if (recording) {
        recognition.stop();
        return;
    }
    startVoice();
}

function startVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
        alert("Speech Recognition not supported right now.");
        return;
    }
    recognition = new Speech();
    recognition.lang = (lang === "en") ? "en-IN" : (lang === "hi" ? "hi-IN" : "mr-IN");
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        recording = true;
        const vb = document.getElementById("voiceBtn");
        if (vb) vb.innerText = t("voice_on");
        setStatus(t("analyzing"));
    };

    recognition.onresult = (ev) => {
        const text = ev.results[0][0].transcript;
        const ta = getInputElByIds(["symptomsText", "symptoms"]);
        if (ta) ta.value = text;
    };

    recognition.onerror = (ev) => {
        console.warn("Voice error", ev);
        setStatus(t("network_err") + " " + (ev.error || ""), true);
    };

    recognition.onend = () => {
        recording = false;
        const vb = document.getElementById("voiceBtn");
        if (vb) vb.innerText = t("voice_off");
        setStatus("");
    };

    recognition.start();
}

/* --------- status helper --------- */
function setStatus(msg, isError = false) {
    const s = document.getElementById("status");
    if (!s) return;
    s.innerText = msg || "";
    s.style.color = isError ? "#d9534f" : "rgba(34,34,34,0.85)";
}

/* --------- Build request metadata (if present inputs exist) --------- */
function collectMeta() {
    // flexible lookup for ids changed in UI; returns first non-empty value
    const getVal = (candidates) => {
        for (let id of candidates) {
            const el = document.getElementById(id);
            if (!el) continue;
            const v = (el.value || "").toString().trim();
            if (v) return v;
        }
        return null;
    };

    return {
        age: getVal(["ageInput", "age"]),
        gender: getVal(["genderInput", "gender"]),
        severity: getVal(["severityInput", "severity"]),
        comorbidities: getVal(["comorbiditiesInput", "comorbidities"]),
        meds_or_reports: getVal(["medsInput", "meds_or_reports", "priorMeds"]),
        prior_doctor: getVal(["priorDoctorInput", "prior_doctor", "priorMeds"])
    };
}

/* --------- Analyze -> call backend --------- */
async function analyze() {
    console.log('analyze() invoked');

    // Validate Patient Name (No numbers allowed)
    const patientNameEl = document.getElementById("patientName");
    if (patientNameEl && patientNameEl.value.trim() !== "") {
        const nameVal = patientNameEl.value.trim();
        if (/[0-9]/.test(nameVal)) {
            alert("Patient Name should only contain letters, not numbers.");
            patientNameEl.focus();
            return;
        }
    }

    let txt = "";
    try {
        const ta = getInputElByIds(["symptomsText", "symptoms"]);
        txt = (ta && typeof ta.value !== 'undefined') ? (ta.value || '').toString().trim() : "";
    } catch (e) {
        console.error('error reading symptoms input', e);
        txt = "";
    }
    if (!txt) {
        alert(t("no_input"));
        return;
    }

    setStatus(t("analyzing"));
    const output = document.getElementById("output");
    if (output) output.innerHTML = "";

    try {
        // prepare payload (include metadata if available)
        const meta = collectMeta();
        console.log('analyze payload meta:', meta);

        // Get medical history from localStorage
        const medicalHistory = getMedicalHistory();

        const payload = {
            symptoms: txt,
            ...meta,
            medical_history: medicalHistory  // Add previous medical data
        };
        console.log('POST payload with medical history:', payload);

        let res = await fetch(BACKEND_JSON_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        console.log('fetch sent, awaiting response: ', BACKEND_JSON_URL);

        // fallback if server expects query param (422/400)
        if (res.status === 422 || res.status === 400) {
            const q = encodeURIComponent(txt);
            res = await fetch(`${BACKEND_GET_URL}?symptoms=${q}`, { method: "GET" });
        }

        if (!res.ok) {
            setStatus(`${t("server_err")} ${res.status}`, true);
            if (output) output.innerHTML = `<div class="card" style="color:#991b1b">${t("server_err")} ${res.status}</div>`;
            return;
        }

        const data = await res.json();
        console.log('response data:', data);

        // If backend returns both symptom predictions (predictions) and diseases, remove label dupes
        if (Array.isArray(data.predictions) && Array.isArray(data.diseases)) {
            const diseaseLabels = new Set(data.diseases.map(d => String(d.label || "").toLowerCase()));
            data.predictions = data.predictions.filter(p => !diseaseLabels.has(String(p.label || "").toLowerCase()));
        }

        renderOutput(data);
        setStatus("");

        // If location already allowed, update doctors list
        if (userLocation) fetchNearbyDoctors(userLocation.lat, userLocation.lon);

    } catch (err) {
        console.error(err);
        setStatus(t("network_err") + " " + err, true);
        if (output) output.innerHTML = `<div class="card" style="color:#991b1b">${t("network_err")} ${err}</div>`;
    }
}

/* --------- Render triage bar helper --------- */
function renderTriageBar(score) {
    // score expected 0..1
    const pct = Math.min(1, Math.max(0, Number(score || 0))) * 100;
    // determine color gradient: green -> yellow -> orange -> red
    let color = "#5cb85c";
    if (pct > 80) color = "#d9534f";
    else if (pct > 60) color = "#f97316"; // orange
    else if (pct > 35) color = "#f59e0b"; // amber
    else color = "#10b981"; // green

    return `
        <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-weight:600;color:#334155;margin-bottom:6px;">
                <div>${t("danger_level")}</div><div>${pct.toFixed(0)}%</div>
            </div>
            <div style="width:100%;height:12px;background:#e6f2ef;border-radius:999px;overflow:hidden;border:1px solid rgba(0,0,0,0.03)">
                <div style="width:${pct}%;height:100%;background:${color};transition:width 0.4s ease;"></div>
            </div>
        </div>
    `;
}

/* --------- Render combined output (symptoms + diseases + triage) --------- */
function renderOutput(data) {
    const out = document.getElementById("output");
    if (!out) return;
    out.innerHTML = "";

    const symptoms = Array.isArray(data.predictions) ? data.predictions : [];
    const diseases = Array.isArray(data.diseases) ? data.diseases : [];

    // triage may be { level, score, reasons } or string
    let triageObj = { level: "LOW", score: 0.0, reasons: [] };
    if (data.triage) {
        if (typeof data.triage === "string") {
            triageObj.level = data.triage;
        } else if (typeof data.triage === "object") {
            triageObj.level = data.triage.level || data.triage.level_name || triageObj.level;
            triageObj.score = (typeof data.triage.score === "number") ? data.triage.score : (data.triage.score ? Number(data.triage.score) : 0);
            triageObj.reasons = Array.isArray(data.triage.reasons) ? data.triage.reasons : (data.triage.reasons || []);
        }
    }

    // top triage card
    out.insertAdjacentHTML("beforeend", `<div class="card">${renderTriageBar(triageObj.score)}<div style="font-weight:900;color:#0f766e;margin-bottom:8px">${(String(triageObj.level)).toUpperCase()}</div></div>`);

    // show triage reasons if present
    if (triageObj.reasons && triageObj.reasons.length) {
        const reasonsHtml = triageObj.reasons.map(r => {
            // Try to translate common symptom names in reasons
            let reasonText = String(r);
            if (reasonText.includes("symptom:")) {
                const parts = reasonText.split(":");
                const symVal = parts[1].split("(")[0].trim();
                reasonText = reasonText.replace(symVal, t(symVal));
            }
            return `<li>${escapeHtml(reasonText)}</li>`;
        }).join("");
        out.insertAdjacentHTML("beforeend", `<div class="card"><h3 style="margin-bottom:8px">${t("triage_REASONS")}</h3><ul style="margin-left:18px;color:#475569">${reasonsHtml}</ul></div>`);
    }

    // Medical History Comparison (NEW)
    if (data.history_comparison && data.history_comparison.has_history) {
        const hc = data.history_comparison;
        const insightsHtml = (hc.insights || []).map(i => `<li style="margin-bottom:8px;">${escapeHtml(i)}</li>`).join("");
        const recommendationsHtml = (hc.recommendations || []).map(r => `<li style="margin-bottom:8px;"><strong>${escapeHtml(r)}</strong></li>`).join("");

        const severityBadge = hc.severity_flag === "RECURRING_CONDITION"
            ? `<span style="background:#fca5a5;color:#991b1b;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;margin-left:8px;">⚠️ ${t("recurring")}</span>`
            : '';

        // Show if AI model used medical history
        const aiContextBadge = data.used_medical_history
            ? '<div style="background:#d1fae5;color:#065f46;padding:8px 12px;border-radius:8px;margin-bottom:12px;font-size:13px;font-weight:600;"><span style="font-size:16px;">🤖</span> AI Model analyzed with your medical history context</div>'
            : '';

        const historyCard = `
            <div class="card" style="background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);border-left:4px solid #f59e0b;">
                <h3 style="color:#92400e;margin-bottom:12px;">📋 Medical History Comparison${severityBadge}</h3>
                
                ${aiContextBadge}
                
                <div style="background:rgba(255,255,255,0.7);padding:16px;border-radius:8px;margin-bottom:16px;">
                    <h4 style="color:#78350f;margin-bottom:8px;font-size:15px;">Previous Visit Information</h4>
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;font-size:14px;">
                        <div><strong>👨‍⚕️ Doctor:</strong> ${escapeHtml(hc.previous_doctor)}</div>
                        <div><strong>🏥 Specialty:</strong> ${escapeHtml(hc.previous_specialty)}</div>
                        <div style="grid-column:1/-1;"><strong>🩺 Previous Diagnosis:</strong> ${escapeHtml(hc.previous_diagnosis)}</div>
                        <div style="grid-column:1/-1;"><strong>💊 Previous Medications:</strong> ${escapeHtml(hc.previous_medications)}</div>
                    </div>
                </div>
                
                ${insightsHtml ? `
                    <div style="margin-bottom:16px;">
                        <h4 style="color:#92400e;margin-bottom:8px;font-size:15px;">🔍 Insights</h4>
                        <ul style="margin-left:20px;color:#78350f;">${insightsHtml}</ul>
                    </div>
                ` : ''}
                
                ${recommendationsHtml ? `
                    <div>
                        <h4 style="color:#92400e;margin-bottom:8px;font-size:15px;">💡 Recommendations</h4>
                        <ul style="margin-left:20px;color:#78350f;font-weight:600;">${recommendationsHtml}</ul>
                    </div>
                ` : ''}
            </div>
        `;
        out.insertAdjacentHTML("beforeend", historyCard);
    }

    // Symptom cards
    if (symptoms.length) {
        out.insertAdjacentHTML("beforeend", `<h3 style="color:#0f766e;margin-top:10px">${t("top_symptoms")}</h3>`);
        symptoms.forEach(p => {
            const testsHtml = (Array.isArray(p.recommended_tests) ? p.recommended_tests : [])
                .map(tst => (typeof tst === "string") ? `<li>${escapeHtml(t(tst))}</li>` : `<li><b>${escapeHtml(t(tst.test || tst.name || ""))}</b> — ${escapeHtml(tst.reason || tst.desc || "")}</li>`)
                .join("");
            const specialistsHtml = Array.isArray(p.specialists) ? p.specialists.map(s => t(s)).join(", ") : t(p.specialists || "");
            const card = `
                <div class="card">
                    <h2>🩺 ${escapeHtml(t(p.label || "Unknown"))} — <span class="score">${(p.score || 0).toFixed(2)}</span></h2>
                    <p>${escapeHtml(p.desc || "")}</p>
                    <div style="display:flex;gap:12px;flex-wrap:wrap;">
                        <div><b>👨‍⚕ ${t("specialists")}:</b> ${escapeHtml(specialistsHtml)}</div>
                    </div>
                    <h4 style="margin-top:10px;">🧪 ${t("suggested_tests")}</h4>
                    <ul>${testsHtml}</ul>
                </div>`;
            out.insertAdjacentHTML("beforeend", card);
        });
    }

    // Disease cards
    if (diseases.length) {
        out.insertAdjacentHTML("beforeend", `<h3 style="color:#0f766e;margin-top:20px">${t("possible_diseases")}</h3>`);
        diseases.forEach(d => {
            const testsHtml = (Array.isArray(d.recommended_tests) ? d.recommended_tests : [])
                .map(tst => (typeof tst === "string") ? `<li>${escapeHtml(t(tst))}</li>` : `<li><b>${escapeHtml(t(tst.test || tst.name || ""))}</b> — ${escapeHtml(tst.reason || tst.desc || "")}</li>`)
                .join("");
            const specialistsHtml = Array.isArray(d.specialists) ? d.specialists.map(s => t(s)).join(", ") : t(d.specialists || "");
            const card = `
                <div class="card">
                    <h2>🦠 ${escapeHtml(t(d.label || "Unknown"))} — <span class="score">${(d.score || 0).toFixed(2)}</span></h2>
                    <p>${escapeHtml(d.description || d.desc || "")}</p>
                    <div style="display:flex;gap:12px;flex-wrap:wrap;">
                        <div><b>👨‍⚕ ${t("specialists")}:</b> ${escapeHtml(specialistsHtml)}</div>
                    </div>
                    <h4 style="margin-top:10px;">🧪 ${t("suggested_tests")}</h4>
                    <ul>${testsHtml}</ul>
                </div>`;
            out.insertAdjacentHTML("beforeend", card);
        });
    }

    // show triage mapping table if backend sent it
    if (Array.isArray(data.triage_mapping) && data.triage_mapping.length) {
        const mappingHtml = data.triage_mapping.map(m => `<li><b>${escapeHtml(m.priority || m.priority_name || "")}</b>: ${escapeHtml((m.symptoms || []).join(", "))} — ${escapeHtml(m.advice || "")}</li>`).join("");
        out.insertAdjacentHTML("beforeend", `<div class="card"><h3>${t("triage_ref")}</h3><ul style="margin-left:18px;color:#475569">${mappingHtml}</ul></div>`);
    }

    // small disclaimer if provided
    if (data.disclaimer) {
        out.insertAdjacentHTML("beforeend", `<div class="card"><b>${t("disclaimer")}</b></div>`);
    }
}

/* --------- escape helper --------- */
function escapeHtml(s) {
    if (!s && s !== 0) return "";
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

/* --------- Location & Overpass doctors --------- */
function requestLocation() {
    if (!navigator.geolocation) {
        showLocationErrorUI("Geolocation not supported by your browser.");
        return;
    }
    setStatus("📍 Obtaining location...");
    const listEl = document.getElementById("doctorsList");
    if (listEl) {
        listEl.innerHTML = '<p style="color:rgba(34,34,34,0.8)">📍 Requesting location access...</p>';
    }

    navigator.geolocation.getCurrentPosition(pos => {
        userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setStatus(`✅ Location obtained`, false);
        if (document.getElementById("nearbyTitle")) document.getElementById("nearbyTitle").innerText = t("nearby_title");
        fetchNearbyDoctors(userLocation.lat, userLocation.lon);
    }, err => {
        console.warn("loc error", err);
        // Don't show error in status bar - show it in the doctors panel instead
        setStatus("", false);
        showLocationErrorUI(getLocationErrorMessage(err));
    }, { enableHighAccuracy: false, maximumAge: 600000, timeout: 20000 });
}

function getLocationErrorMessage(err) {
    switch (err.code) {
        case err.PERMISSION_DENIED:
            return "Location access was denied. You can still use symptom analysis without this feature.";
        case err.POSITION_UNAVAILABLE:
            return "Location information is unavailable. Please check your device settings.";
        case err.TIMEOUT:
            return "Location request timed out. Please try again.";
        default:
            return "An unknown error occurred while requesting location.";
    }
}

function showLocationErrorUI(message) {
    const listEl = document.getElementById("doctorsList");
    if (!listEl) return;

    listEl.innerHTML = `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); 
                    border-left: 4px solid #f59e0b; 
                    padding: 20px; 
                    border-radius: 12px;
                    margin: 10px 0;">
            <div style="display: flex; align-items: start; gap: 12px;">
                <div style="font-size: 28px; flex-shrink: 0;">📍</div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 8px 0; color: #92400e; font-size: 16px;">Location Optional</h4>
                    <p style="margin: 0 0 12px 0; color: #78350f; font-size: 14px; line-height: 1.5;">
                        ${escapeHtml(message)}
                    </p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="requestLocation()" 
                                style="background: #f59e0b; color: white; border: none; 
                                       padding: 8px 16px; border-radius: 6px; cursor: pointer;
                                       font-weight: 600; font-size: 13px; transition: all 0.3s;">
                            🔄 Try Again
                        </button>
                        <button onclick="showDemoDoctors()" 
                                style="background: #0f766e; color: white; border: none; 
                                       padding: 8px 16px; border-radius: 6px; cursor: pointer;
                                       font-weight: 600; font-size: 13px; transition: all 0.3s;">
                            🎭 Use Demo Mode
                        </button>
                        <button onclick="showLocationHelp()" 
                                style="background: #fff; color: #92400e; border: 2px solid #f59e0b; 
                                       padding: 8px 16px; border-radius: 6px; cursor: pointer;
                                       font-weight: 600; font-size: 13px; transition: all 0.3s;">
                            ℹ️ How to Enable
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <p style="color: rgba(34,34,34,0.6); font-size: 13px; margin-top: 12px; text-align: center;">
            💡 The symptom analysis feature works perfectly without location access
        </p>
    `;
}

function showLocationHelp() {
    const helpHTML = `
        <div style="background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h3 style="color: #0f766e; margin-top: 0;">How to Enable Location Access</h3>
            
            <div style="margin: 16px 0;">
                <h4 style="color: #334155; margin-bottom: 8px;">📱 Chrome/Edge:</h4>
                <ol style="color: #475569; line-height: 1.8; margin-left: 20px;">
                    <li>Click the <strong>lock icon</strong> or <strong>info icon</strong> in the address bar</li>
                    <li>Find "Location" permissions</li>
                    <li>Select <strong>"Allow"</strong></li>
                    <li>Refresh the page and try again</li>
                </ol>
            </div>
            
            <div style="margin: 16px 0;">
                <h4 style="color: #334155; margin-bottom: 8px;">🦊 Firefox:</h4>
                <ol style="color: #475569; line-height: 1.8; margin-left: 20px;">
                    <li>Click the <strong>lock icon</strong> in the address bar</li>
                    <li>Click on "Permissions"</li>
                    <li>Find "Access Your Location" and click "Allow"</li>
                    <li>Refresh the page and try again</li>
                </ol>
            </div>
            
            <div style="margin: 16px 0; padding: 12px; background: #f0fdfa; border-radius: 8px; border-left: 3px solid #14b8a6;">
                <p style="color: #0f766e; margin: 0; font-size: 14px;">
                    <strong>Note:</strong> Location access is completely optional. You can use all symptom analysis features without it!
                </p>
            </div>
            
            <button onclick="document.getElementById('doctorsList').innerHTML = '<p style=\\'color:rgba(34,34,34,0.7)\\'>Click \\'Find Nearby Doctors\\' to try again.</p>'" 
                    style="background: #0f766e; color: white; border: none; padding: 10px 20px; 
                           border-radius: 6px; cursor: pointer; font-weight: 600; margin-top: 12px;">
                Got it!
            </button>
        </div>
    `;

    const listEl = document.getElementById("doctorsList");
    if (listEl) listEl.innerHTML = helpHTML;
}

async function fetchNearbyDoctors(lat, lon) {
    const listEl = document.getElementById("doctorsList");
    if (!listEl) return;
    listEl.innerHTML = "<p style='color:rgba(34,34,34,0.8)'>Searching nearby doctors…</p>";

    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="doctors"](around:${NEARBY_RADIUS},${lat},${lon});
          node["amenity"="clinic"](around:${NEARBY_RADIUS},${lat},${lon});
          node["healthcare"="doctor"](around:${NEARBY_RADIUS},${lat},${lon});
        );
        out center ${MAX_DOCTORS};
    `;

    try {
        const res = await fetch(OVERPASS_API, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: `data=${encodeURIComponent(query)}`
        });
        if (!res.ok) { listEl.innerHTML = `<p style="color:#d44">Doctor search failed (${res.status})</p>`; return; }
        const json = await res.json();
        const elems = json.elements || [];
        if (!elems.length) {
            listEl.innerHTML = `<p style="color:rgba(34,34,34,0.7)">No nearby doctors found within ${(NEARBY_RADIUS / 1000).toFixed(1)} km.</p>`;
            return;
        }

        const withDist = elems.map(el => {
            const lat2 = el.lat || (el.center && el.center.lat);
            const lon2 = el.lon || (el.center && el.center.lon);
            const d = distanceMeters(lat, lon, lat2, lon2);
            const name = (el.tags && (el.tags.name || el.tags.operator)) || "Doctor / Clinic";
            const addr = [
                el.tags && el.tags["addr:street"],
                el.tags && el.tags["addr:housenumber"],
                el.tags && el.tags["addr:city"],
                el.tags && el.tags["addr:postcode"]
            ].filter(Boolean).join(", ");
            return { name, addr, lat: lat2, lon: lon2, dist: d, tags: el.tags || {} };
        });

        withDist.sort((a, b) => a.dist - b.dist);
        listEl.innerHTML = "";
        withDist.slice(0, MAX_DOCTORS).forEach(d => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.lat + ',' + d.lon)}`;
            const doctorHtml = `
                <div class="doctor">
                    <div class="left">
                        <h4>${escapeHtml(d.name)}</h4>
                        <div class="meta">${escapeHtml(d.addr || (d.tags.specialty || "Clinic"))}</div>
                        <div class="meta">${(d.dist < 1000) ? (d.dist.toFixed(0) + " m") : ((d.dist / 1000).toFixed(2) + " km")}</div>
                    </div>
                    <div class="right">
                        <a class="map-link" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
                    </div>
                </div>`;
            listEl.insertAdjacentHTML("beforeend", doctorHtml);
        });

    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<p style="color:#d44">${t("network_err")} ${err}</p>`;
    }
}

function distanceMeters(lat1, lon1, lat2, lon2) {
    if (![lat1, lon1, lat2, lon2].every(v => typeof v === "number")) return 1e9;
    const R = 6371e3;
    const toRad = v => v * Math.PI / 180;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/* --------- Medical history modal & uploads (localStorage) --------- */
function showTriageTable() {
    const modal = document.getElementById("triageModal");
    if (modal) modal.style.display = "block";
}

function closeTriageTable() {
    const modal = document.getElementById("triageModal");
    if (modal) modal.style.display = "none";
}

function saveTriageData() {
    const triageData = {
        visitDate: document.getElementById("visitDate") ? document.getElementById("visitDate").value : "",
        doctorName: document.getElementById("doctorName") ? document.getElementById("doctorName").value : "",
        specialty: document.getElementById("specialty") ? document.getElementById("specialty").value : "",
        diagnosis: document.getElementById("diagnosis") ? document.getElementById("diagnosis").value : "",
        medications: document.getElementById("medications") ? document.getElementById("medications").value : "",
        treatment: document.getElementById("treatment") ? document.getElementById("treatment").value : "",
        savedAt: new Date().toISOString()
    };
    localStorage.setItem('medicalHistory', JSON.stringify(triageData));

    // Show success message
    const successMsg = document.createElement('div');
    successMsg.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; z-index: 10000; 
                    background: linear-gradient(135deg, #10b981, #059669); 
                    color: white; padding: 20px 24px; border-radius: 12px; 
                    box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4);
                    animation: slideIn 0.3s ease;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">✅</span>
                <div>
                    <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">Medical History Saved!</div>
                    <div style="font-size: 13px; opacity: 0.9;">Your previous medical details have been stored.</div>
                    <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Now enter your current symptoms and click Analyze to compare!</div>
                </div>
            </div>
        </div>
        <style>
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        </style>
    `;
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 5000);

    closeTriageTable();
}

function getMedicalHistory() {
    try {
        const hist = localStorage.getItem('medicalHistory');
        if (hist) {
            return JSON.parse(hist);
        }
    } catch (e) {
        console.error('Error reading medical history:', e);
    }
    return null;
}

function showAbout() {
    const modal = document.getElementById("aboutModal");
    if (modal) modal.style.display = "block";
}

function closeAbout() {
    const modal = document.getElementById("aboutModal");
    if (modal) modal.style.display = "none";
}

/* File upload helpers (show filenames) */
document.addEventListener('DOMContentLoaded', function () {
    const reportUpload = document.getElementById('reportUpload');
    const prescriptionUpload = document.getElementById('prescriptionUpload');
    if (reportUpload) reportUpload.addEventListener('change', e => handleFileUpload(e.target.files, 'reportFiles'));
    if (prescriptionUpload) prescriptionUpload.addEventListener('change', e => handleFileUpload(e.target.files, 'prescriptionFiles'));
});

function handleFileUpload(files, listId) {
    const fileList = document.getElementById(listId);
    if (!fileList) return;
    const fileArray = Array.from(files);
    fileList.innerHTML = '';
    fileArray.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>📎</span>
            <span style="margin-left:8px">${escapeHtml(file.name)}</span>
            <span style="margin-left:auto; font-size:11px; color:#64748b;">${formatFileSize(file.size)}</span>
        `;
        fileList.appendChild(fileItem);
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

/* --------- Utilities & onload --------- */
window.addEventListener("load", () => {
    changeLanguage();
    if (document.getElementById("nearbyTitle")) document.getElementById("nearbyTitle").innerText = t("nearby_title");
    if (document.getElementById("voiceBtn")) document.getElementById("voiceBtn").innerText = t("voice_off");

    // restore any saved medical history to form (if present)
    const hist = localStorage.getItem('medicalHistory');
    if (hist) {
        try {
            const obj = JSON.parse(hist);
            if (obj) {
                if (document.getElementById("doctorName")) document.getElementById("doctorName").value = obj.doctorName || "";
                if (document.getElementById("diagnosis")) document.getElementById("diagnosis").value = obj.diagnosis || "";
                if (document.getElementById("medications")) document.getElementById("medications").value = obj.medications || "";
            }
        } catch (e) { /* ignore parse errors */ }
    }
});

// Make `analyze` available globally and attach click handlers to buttons as a fallback
(function attachAnalyzeHandler() {
    try {
        if (typeof analyze === 'function') {
            window.analyze = analyze;
        }
    } catch (e) { }

    // attach to any button with class 'analyze' in case inline onclick was removed
    function attachToAnalyzeButtons() {
        try {
            const btns = document.querySelectorAll('button.analyze, .btn.analyze');
            btns.forEach(b => {
                if (!b._analyzeAttached) {
                    b.addEventListener('click', (ev) => {
                        try { window.analyze && window.analyze(); } catch (e) { console.error('analyze handler error', e); }
                    });
                    // also set onclick attribute as a fallback
                    if (!b.getAttribute('onclick')) b.setAttribute('onclick', 'return false;');
                    b._analyzeAttached = true;
                }
            });
        } catch (e) { console.error(e); }
    }

    // attempt immediate attach (script is often loaded after DOM is ready)
    attachToAnalyzeButtons();
    // also attach on DOMContentLoaded for other loading orders
    document.addEventListener('DOMContentLoaded', attachToAnalyzeButtons);

    // helpful startup log
    try { console.log('frontend script loaded — analyze attached'); } catch (e) { }
})();

// Close modal on outside click (triage/about modals if you add them)
window.onclick = function (event) {
    const aboutModal = document.getElementById("aboutModal");
    const triageModal = document.getElementById("triageModal");
    if (aboutModal && event.target == aboutModal) aboutModal.style.display = "none";
    if (triageModal && event.target == triageModal) triageModal.style.display = "none";
};

// Demo mode - shows sample doctors for presentations
function showDemoDoctors() {
    const listEl = document.getElementById("doctorsList");
    if (!listEl) return;

    setStatus("🎭 Demo mode activated", false);

    const demoDoctors = [
        { name: "City General Hospital", specialty: "Multi-specialty", dist: 850, addr: "Main Street, City Center" },
        { name: "Dr. Sarah Johnson - Family Clinic", specialty: "General Physician", dist: 1200, addr: "Park Avenue, Downtown" },
        { name: "Advanced Cardiology Center", specialty: "Cardiologist", dist: 1500, addr: "Medical District, Zone 2" },
        { name: "Dr. Rajesh Kumar - Pediatrics", specialty: "Pediatrician", dist: 2100, addr: "Green Valley Road" },
        { name: "Community Health Clinic", specialty: "General Practice", dist: 2400, addr: "Harbor Street" },
        { name: "Emergency Care 24/7", specialty: "Emergency Medicine", dist: 3200, addr: "Highway Junction" },
        { name: "Women's Health Clinic", specialty: "Gynecologist", dist: 3800, addr: "Lake View Complex" },
        { name: "Dr. Michael Chen - Orthopedics", specialty: "Orthopedic Surgeon", dist: 4200, addr: "Sports Medicine Center" }
    ];

    listEl.innerHTML = `
        <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); 
                    border-left: 4px solid #059669; 
                    padding: 16px; 
                    border-radius: 12px;
                    margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">🎭</span>
                <div>
                    <h4 style="margin: 0 0 4px 0; color: #065f46; font-size: 14px;">Demo Mode Active</h4>
                    <p style="margin: 0; color: #047857; font-size: 12px;">Showing sample healthcare providers for demonstration</p>
                </div>
            </div>
        </div>
    `;

    demoDoctors.forEach(d => {
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name + ' ' + d.addr)}`;
        const doctorHtml = `
            <div class="doctor">
                <div class="left">
                    <h4>${escapeHtml(d.name)}</h4>
                    <div class="meta">${escapeHtml(d.specialty)}</div>
                    <div class="meta">${escapeHtml(d.addr)}</div>
                    <div class="meta">${(d.dist < 1000) ? (d.dist + " m") : ((d.dist / 1000).toFixed(1) + " km")}</div>
                </div>
                <div class="right">
                    <a class="map-link" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
                </div>
            </div>`;
        listEl.insertAdjacentHTML("beforeend", doctorHtml);
    });
}

/**
 * Generates a comprehensive PDF medical report
 */
function generatePDFReport() {
    const nameEl = document.getElementById("patientName");
    if (nameEl && nameEl.value.trim() !== "" && /[0-9]/.test(nameEl.value)) {
        alert("Patient Name should only contain letters, not numbers.");
        nameEl.focus();
        return;
    }

    const patientName = nameEl?.value || "Valued Patient";
    const age = document.getElementById("age")?.value || "N/A";
    const gender = document.getElementById("gender")?.value || "N/A";
    const symptoms = document.getElementById("symptomsText")?.value || "No symptoms described";
    const outputArea = document.getElementById("output");
    const history = getMedicalHistory();

    if (!outputArea || outputArea.innerHTML.trim() === "") {
        alert("Please run an analysis first to include results in the report.");
        return;
    }

    const reportContainer = document.createElement("div");
    reportContainer.style.padding = "40px";
    reportContainer.style.fontFamily = "'Inter', sans-serif";
    reportContainer.style.color = "#1e293b";

    // Header with professional title page look
    let content = `
        <div style="text-align: center; margin-bottom: 40px; padding: 50px 20px; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); border-radius: 12px; color: white; margin-top: 0;">
            <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; opacity: 0.8;">Official Health Document</div>
            <h1 style="margin: 0; font-size: 42px; text-transform: uppercase; letter-spacing: 5px; font-weight: 800; line-height: 1;">Medical Report</h1>
            <div style="width: 80px; height: 5px; background: white; margin: 20px auto; border-radius: 10px;"></div>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 500;">ZSL Medical Assistant</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.7;">AI-Powered Diagnostic Analysis</p>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px;">
            <div style="color: #64748b; font-size: 13px;">
                <strong>Report ID:</strong> ${Math.random().toString(36).substr(2, 9).toUpperCase()}
            </div>
            <div style="text-align: right; color: #64748b; font-size: 13px;">
                <strong>Date:</strong> ${new Date().toLocaleDateString()}<br>
                <strong>Time:</strong> ${new Date().toLocaleTimeString()}
            </div>
        </div>

        <div style="margin-bottom: 30px; background: #f8fafb; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <h3 style="color: #0d9488; margin-top: 0; border-bottom: 2px solid #0d9488; padding-bottom: 12px; font-size: 20px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 10px;">👤</span> Patient Profiles
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                    <td style="padding: 10px 0; width: 30%; color: #64748b;"><strong>Patient Name:</strong></td>
                    <td style="padding: 10px 0; font-size: 16px; color: #1e293b; font-weight: 600;">${escapeHtml(patientName)}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b;"><strong>Age:</strong></td>
                    <td style="padding: 10px 0; font-size: 16px; color: #1e293b;">${escapeHtml(age)}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b;"><strong>Gender:</strong></td>
                    <td style="padding: 10px 0; font-size: 16px; color: #1e293b;">${escapeHtml(gender)}</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom: 30px; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <h3 style="color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 12px; font-size: 20px; margin-top: 0;">
                <span style="font-size: 24px; margin-right: 10px;">📝</span> Reported Symptoms
            </h3>
            <p style="background: #ffffff; padding: 15px; border-radius: 8px; line-height: 1.8; color: #334155; font-size: 15px; font-style: italic;">
                "${escapeHtml(symptoms)}"
            </p>
        </div>
    `;

    // History
    if (history) {
        content += `
            <div style="margin-bottom: 30px; background: #fffcf0; padding: 25px; border-radius: 12px; border: 1px solid #fde68a;">
                <h3 style="color: #92400e; margin-top: 0; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; font-size: 20px;">
                    <span style="font-size: 24px; margin-right: 10px;">📋</span> Previous Medical History
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 15px;">
                    <tr><td style="padding: 8px 0; width: 30%; color: #78350f;"><strong>Last Visit:</strong></td><td style="color: #1e293b;">${escapeHtml(history.visitDate || 'N/A')}</td></tr>
                    <tr><td style="padding: 8px 0; color: #78350f;"><strong>Doctor:</strong></td><td style="font-weight: 600; color: #1e293b;">${escapeHtml(history.doctorName || 'N/A')} <span style="font-weight: 400; color: #64748b;">(${escapeHtml(history.specialty || 'N/A')})</span></td></tr>
                    <tr><td style="padding: 8px 0; color: #78350f;"><strong>Previous Diagnosis:</strong></td><td style="color: #1e293b;">${escapeHtml(history.diagnosis || 'N/A')}</td></tr>
                    <tr><td style="padding: 8px 0; color: #78350f;"><strong>Medications:</strong></td><td style="color: #1e293b;">${escapeHtml(history.medications || 'N/A')}</td></tr>
                    <tr><td style="padding: 8px 0; color: #78350f;"><strong>Treatment:</strong></td><td style="line-height: 1.6; color: #1e293b;">${escapeHtml(history.treatment || 'N/A')}</td></tr>
                </table>
            </div>
        `;
    }

    // AI Analysis Results
    content += `
        <div style="margin-bottom: 30px;">
            <h3 style="color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 12px; font-size: 20px; margin-top: 0;">
                <span style="font-size: 24px; margin-right: 10px;">🧠</span> AI Analysis & Diagnosis
            </h3>
            <div id="pdf-results-placeholder" style="margin-top: 20px;">
                ${outputArea.innerHTML}
            </div>
        </div>

        <div style="margin-top: 50px; padding: 25px; background: #fef2f2; border-radius: 12px; border-left: 5px solid #dc2626; font-size: 13px; color: #991b1b; line-height: 1.6;">
            <strong style="font-size: 15px; margin-bottom: 8px; display: block;">⚠️ Medical Disclaimer:</strong> 
            This document is an AI-generated health report provided for informational purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. 
            <strong>Action Required:</strong> Please consult with a qualified healthcare professional immediately to review these findings. In case of a medical emergency, contact your local emergency services (e.g., 911 or 112) without delay.
        </div>
        
        <div style="text-align: center; margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Generated by <strong>ZSL Medical Assistant</strong> — Advanced Healthcare AI Technology Platform<br>
            &copy; ${new Date().getFullYear()} AI Health Assistant. All rights reserved.
        </div>
    `;

    reportContainer.innerHTML = content;

    // Remove buttons and UI elements from the copied output
    const elementsToRemove = reportContainer.querySelectorAll('button, .map-link, .triage-mapping-reference');
    elementsToRemove.forEach(el => el.remove());

    const opt = {
        margin: [10, 10],
        filename: `Medical_Report_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Use html2pdf
    html2pdf().set(opt).from(reportContainer).save();
}
