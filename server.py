# server.py (updated)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any, Dict
import uvicorn
import os
import sys
import traceback
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("server")

# Fix path so pipeline/triage can be imported from src/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(BASE_DIR, "src")
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# ----------------------------
# Import symptom pipeline (safe)
# ----------------------------
infer = None
pipeline_error = None
try:
    # try direct import first
    from pipeline import infer as _infer
    infer = _infer
    log.info("Imported pipeline.infer from project root.")
except Exception:
    try:
        # try from src
        from src.pipeline import infer as _infer
        infer = _infer
        log.info("Imported src.pipeline.infer.")
    except Exception as e:
        pipeline_error = f"Failed to import pipeline.infer: {e}"
        log.warning(pipeline_error)
        log.debug(traceback.format_exc())

# If import failed, provide a safe fallback infer() so server doesn't crash
if infer is None:
    def infer(text: str) -> Dict[str, Any]:
        """
        Fallback dummy pipeline. Returns minimal structure so frontend can still work.
        Real pipeline import failed — see /health or pipeline_error in responses.
        """
        return {
            "normalized_text": text,
            "predictions": [],
            "triage": {},
            "pipeline_error": pipeline_error or "pipeline not available"
        }

# ----------------------------
# Import triage (safe)
# ----------------------------
triage_assess = None
MAPPING_TABLE = []

# optional disease predictor
disease_predict = None
try:
    from pipeline_disease import predict_disease as _predict_disease
    disease_predict = _predict_disease
    log.info("Imported pipeline_disease.predict_disease from project root.")
except Exception:
    try:
        from src.pipeline_disease import predict_disease as _predict_disease
        disease_predict = _predict_disease
        log.info("Imported src.pipeline_disease.predict_disease.")
    except Exception as e:
        log.warning(f"Failed to import pipeline_disease.predict_disease: {e}")
        log.debug(traceback.format_exc())
try:
    from triage import assess as _assess, MAPPING_TABLE as _map
    triage_assess = _assess
    MAPPING_TABLE = _map
    log.info("Imported triage.assess from project root.")
except Exception:
    try:
        from src.triage import assess as _assess, MAPPING_TABLE as _map
        triage_assess = _assess
        MAPPING_TABLE = _map
        log.info("Imported src.triage.assess.")
    except Exception as e:
        log.warning(f"Failed to import triage.assess: {e}")
        log.debug(traceback.format_exc())
        # fallback simple assessor
        def triage_assess(symptoms: str, age: Optional[int] = None, severity_label: Optional[str] = None,
                          comorbidities_text: Optional[str] = None, meds_or_report_text: Optional[str] = None):
            # very simple heuristic fallback
            s = (symptoms or "").lower()
            level = "LOW"
            score = 0.0
            reasons = []
            if any(x in s for x in ["chest pain", "shortness of breath", "breathless", "loss of consciousness", "severe bleeding"]):
                level = "HIGH"; score = 0.9; reasons.append("critical symptom matched")
            elif any(x in s for x in ["high fever", "confusion", "seizure"]):
                level = "MEDIUM"; score = 0.5; reasons.append("warning symptom matched")
            else:
                level = "LOW"; score = 0.1; reasons.append("no red-flag symptoms")
            return {"level": level, "score": score, "reasons": reasons}
        MAPPING_TABLE = [
            {"symptoms": ["chest pain", "shortness of breath"], "priority": "HIGH", "advice": "Seek emergency care."},
            {"symptoms": ["fever", "confusion"], "priority": "MEDIUM", "advice": "See doctor soon."},
            {"symptoms": ["cough", "sore throat"], "priority": "LOW", "advice": "Home care / GP if persists."}
        ]

# ----------------------------
# FastAPI server
# ----------------------------
app = FastAPI(title="AI Health Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    symptoms: str
    age: Optional[int] = None
    gender: Optional[str] = None
    severity: Optional[str] = None  # mild|moderate|severe
    comorbidities: Optional[str] = None
    meds_or_reports: Optional[str] = None
    prior_doctor: Optional[str] = None
    medical_history: Optional[Dict[str, Any]] = None  # Previous medical data

@app.get("/health")
def health():
    """
    Small health endpoint to check what components are available.
    """
    return {
        "ok": True,
        "pipeline_loaded": False if pipeline_error else True,
        "pipeline_error": pipeline_error,
        "triage_loaded": triage_assess is not None,
    }

@app.get("/")
def root():
    return {"message": "AI Health Assistant Backend Running!"}

@app.post("/predict")
def predict(req: PredictRequest):
    symptoms = (req.symptoms or "").strip()
    if not symptoms:
        return {"error": "Symptoms required"}

    # Enrich symptoms with medical history context for AI model
    enriched_symptoms = symptoms
    history_context = ""
    
    if req.medical_history:
        history_parts = []
        if req.medical_history.get("diagnosis"):
            history_parts.append(f"Previous diagnosis: {req.medical_history['diagnosis']}")
        if req.medical_history.get("medications"):
            history_parts.append(f"Previous medications: {req.medical_history['medications']}")
        if req.medical_history.get("treatment"):
            history_parts.append(f"Previous treatment: {req.medical_history['treatment']}")
        
        if history_parts:
            history_context = ". Medical history: " + ", ".join(history_parts)
            enriched_symptoms = symptoms + history_context
            log.info(f"Enriched symptoms with medical history context: {enriched_symptoms}")

    # 1) symptom-level predictions WITH MEDICAL HISTORY CONTEXT
    try:
        base = infer(enriched_symptoms)  # AI model now gets full context!
        base["used_medical_history"] = bool(req.medical_history)
        base["original_symptoms"] = symptoms
    except Exception as e:
        log.error("Pipeline infer() raised exception: %s", e)
        log.debug(traceback.format_exc())
        base = {"predictions": [], "normalized_text": enriched_symptoms, "triage": {}}
        base["pipeline_error"] = str(e)

    # 2) disease-level predictions: try to call disease predictor if available
    try:
        if disease_predict is not None:
            # Also pass enriched symptoms to disease predictor
            dp = disease_predict(enriched_symptoms)
            if isinstance(dp, dict):
                base["diseases"] = dp.get("predictions", [])
            else:
                base["diseases"] = []
        else:
            if "diseases" not in base:
                base["diseases"] = []
    except Exception as e:
        log.error("disease_predict raised exception: %s", e)
        log.debug(traceback.format_exc())
        base["diseases"] = []

    # If no disease predictions from the model, try a lightweight dataset lookup fallback
    try:
        if not base.get("diseases"):
            try:
                from src.disease_lookup import find_diseases_by_text
            except Exception:
                try:
                    from disease_lookup import find_diseases_by_text
                except Exception:
                    find_diseases_by_text = None

            if find_diseases_by_text:
                # Use enriched symptoms for better matching
                fallback = find_diseases_by_text(enriched_symptoms, path=os.path.join(BASE_DIR, "data", "diseases.jsonl"), top_n=6)
                base["diseases"] = fallback
                base["diseases_source"] = "fallback_lookup"
    except Exception as e:
        log.error("disease lookup fallback failed: %s", e)
        log.debug(traceback.format_exc())

    # 3) triage assessment (improved) - also use enriched symptoms
    try:
        tri = triage_assess(enriched_symptoms,  # Triage also gets full context
                            age=req.age,
                            severity_label=(req.severity or ""),
                            comorbidities_text=(req.comorbidities or ""),
                            meds_or_report_text=(req.meds_or_reports or ""))
    except Exception as e:
        log.error("triage_assess raised exception: %s", e)
        log.debug(traceback.format_exc())
        tri = {"level": "LOW", "score": 0.0, "reasons": [f"triage_error: {e}"]}

    base["triage"] = tri
    base["triage_mapping"] = MAPPING_TABLE

    # 4) Medical history comparison (for UI display)
    if req.medical_history:
        try:
            comparison = compare_medical_history(req.medical_history, symptoms, base.get("diseases", []))
            base["history_comparison"] = comparison
            
            # Add note that AI model used this context
            comparison["model_context_note"] = "✅ AI model analyzed symptoms with your medical history context"
        except Exception as e:
            log.error("Medical history comparison failed: %s", e)
            base["history_comparison"] = {"error": str(e)}

    # echo back user meta for frontend
    base["user_meta"] = {
        "age": req.age,
        "gender": req.gender,
        "severity": req.severity,
        "prior_doctor": req.prior_doctor
    }

    # include pipeline import error if present
    if pipeline_error:
        base["pipeline_error_import"] = pipeline_error

    return base

def compare_medical_history(history: Dict[str, Any], current_symptoms: str, current_diseases: list) -> Dict[str, Any]:
    """
    Compare previous medical history with current symptoms/diagnosis
    """
    comparison = {
        "has_history": True,
        "previous_diagnosis": history.get("diagnosis", "Not specified"),
        "previous_medications": history.get("medications", "Not specified"),
        "previous_doctor": history.get("doctorName", "Not specified"),
        "previous_specialty": history.get("specialty", "Not specified"),
        "insights": [],
        "recommendations": []
    }
    
    # Check if current symptoms match previous diagnosis
    prev_diagnosis = (history.get("diagnosis") or "").lower()
    current_symp_lower = current_symptoms.lower()
    
    if prev_diagnosis and any(word in current_symp_lower for word in prev_diagnosis.split()):
        comparison["insights"].append("⚠️ Current symptoms may be related to your previous diagnosis")
        comparison["recommendations"].append("Consider consulting with your previous doctor: " + history.get("doctorName", "specialist"))
    
    # Check if patient was on medications
    prev_meds = history.get("medications", "")
    if prev_meds and prev_meds.strip():
        comparison["insights"].append("📋 You have previous medication history")
        comparison["recommendations"].append("Inform your doctor about previous medications: " + prev_meds[:100])
    
    # Check for recurring issues
    current_disease_names = [d.get("label", "").lower() for d in current_diseases if isinstance(d, dict)]
    if prev_diagnosis and any(prev_diagnosis in disease for disease in current_disease_names):
        comparison["insights"].append("🔄 Possible recurring condition detected")
        comparison["recommendations"].append("HIGH PRIORITY: This may be a recurring issue from your previous visit")
        comparison["severity_flag"] = "RECURRING_CONDITION"
    
    # Time-based insights
    if history.get("savedAt"):
        comparison["insights"].append(f"📅 Medical history saved on: {history.get('savedAt', '')[:10]}")
    
    if not comparison["insights"]:
        comparison["insights"].append("ℹ️ No direct correlation found with previous medical history")
        comparison["recommendations"].append("Continue with standard analysis")
    
    return comparison


if __name__ == "__main__":
    # Run without the auto-reloader to avoid mid-request restarts
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
