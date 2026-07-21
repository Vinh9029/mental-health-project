"""
=============================================================================
LLM-AS-A-JUDGE — Mental Health NLP Models
=============================================================================
Purpose:
  1. Load saved model predictions (from 01_quantitative_evaluation.py output)
     OR re-run inference here.
  2. Select 50 "edge-case" samples using three criteria:
       (a) SVM wrong, BERT right  ← shows BERT's contextual advantage
       (b) All 3 models wrong     ← true hard / ambiguous cases
       (c) Minority classes only (suicidal, depression, personality disorder)
  3. Build a structured JSON + prompt file ready to be sent to GPT-4o/Claude.
  4. (OPTIONAL) If OPENAI_API_KEY is present in env, call gpt-4o automatically
     and save results.  Otherwise save prompts to CSV for manual submission.

Run on Kaggle:
  - Input:  /kaggle/input/datasets/dx9029/mental-health/
            /kaggle/input/mental-health-models/
            /kaggle/working/quantitative_results.csv  (from script 01)
  - Output: /kaggle/working/
=============================================================================
"""

# ─────────────────────────────────────────────────────────────────────────────
# 1. IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
import os
import gc
import json
import pickle
import random
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.svm import LinearSVC

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# 2. PATHS & CONFIG
# ─────────────────────────────────────────────────────────────────────────────
DATA_DIR   = Path("/kaggle/input/datasets/dx9029/mental-health")
MODEL_DIR  = Path("/kaggle/input/mental-health-models")
OUTPUT_DIR = Path("/kaggle/working")
OUTPUT_DIR.mkdir(exist_ok=True)

BERT_MODEL_NAME = "mental-bert-base-uncased"
BERT_MAX_LEN    = 128
BERT_BATCH_SIZE = 64
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

CLASS_NAMES = ["anxiety", "bipolar", "depression", "normal",
               "personality disorder", "stress", "suicidal"]
NUM_CLASSES = len(CLASS_NAMES)

# Minority (clinically critical) classes — prioritised in sampling
CRITICAL_CLASSES = {"suicidal", "depression", "personality disorder"}

N_SAMPLES = 50          # total edge-case samples to extract
RANDOM_SEED = 42


# ─────────────────────────────────────────────────────────────────────────────
# 3. BI-LSTM ARCHITECTURE (must match training)
# ─────────────────────────────────────────────────────────────────────────────
class BiLSTMClassifier(nn.Module):
    def __init__(self, input_size, hidden_size=256, num_layers=3,
                 num_classes=7, dropout=0.4):
        super().__init__()
        self.lstm = nn.LSTM(input_size=input_size, hidden_size=hidden_size,
                            num_layers=num_layers, batch_first=True,
                            bidirectional=True, dropout=dropout)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 512), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(512, 256),            nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


# ─────────────────────────────────────────────────────────────────────────────
# 4. LOAD DATA
# ─────────────────────────────────────────────────────────────────────────────
def load_data():
    print("Loading data ...")
    with open(DATA_DIR / "X_test_scaled.pkl", "rb") as f:
        X_test = pickle.load(f)
    with open(DATA_DIR / "y_test.pkl", "rb") as f:
        y_test = pickle.load(f)
    with open(DATA_DIR / "label_mapping.pkl", "rb") as f:
        label_mapping = pickle.load(f)
    test_df = pd.read_csv(DATA_DIR / "test_processed.csv")

    # Detect text column
    text_col = "statement" if "statement" in test_df.columns else test_df.columns[0]
    print(f"  ✓ X_test: {X_test.shape} | y_test: {len(y_test)} | text_col: '{text_col}'")
    return X_test, np.array(y_test), label_mapping, test_df, text_col


# ─────────────────────────────────────────────────────────────────────────────
# 5. INFERENCE HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def run_svm(X_test):
    print("  Running SVM ...")
    with open(MODEL_DIR / "svm_model_full.pkl", "rb") as f:
        model = pickle.load(f)
    preds = model.predict(X_test)
    del model; gc.collect()
    return preds


def run_bilstm(X_test):
    print("  Running Bi-LSTM ...")
    X_t = torch.FloatTensor(
        X_test.toarray() if hasattr(X_test, "toarray") else X_test
    ).unsqueeze(1)
    model = BiLSTMClassifier(input_size=X_t.shape[2]).to(DEVICE)
    model.load_state_dict(torch.load(MODEL_DIR / "lstm_model_full.pt", map_location=DEVICE))
    model.eval()
    all_preds = []
    with torch.no_grad():
        for (b,) in DataLoader(TensorDataset(X_t), batch_size=256):
            all_preds.append(model(b.to(DEVICE)).argmax(1).cpu().numpy())
    del model; gc.collect(); torch.cuda.empty_cache()
    return np.concatenate(all_preds)


def run_bert(texts):
    print("  Running BERT ...")
    bert_path = MODEL_DIR / BERT_MODEL_NAME
    if not bert_path.exists():
        if (MODEL_DIR / "bert_model_full").exists():
            bert_path = MODEL_DIR / "bert_model_full"
        elif (MODEL_DIR / "config.json").exists():
            bert_path = MODEL_DIR
        else:
            config_files = list(MODEL_DIR.glob("**/config.json"))
            if config_files:
                bert_path = config_files[0].parent
            else:
                bert_path = Path("mental/mental-bert-base-uncased")

    tokenizer = AutoTokenizer.from_pretrained(str(bert_path))
    model = AutoModelForSequenceClassification.from_pretrained(
        str(bert_path), num_labels=NUM_CLASSES).to(DEVICE)
    model.eval()
    all_preds = []
    for i in range(0, len(texts), BERT_BATCH_SIZE):
        batch = texts[i: i + BERT_BATCH_SIZE]
        enc = tokenizer(batch, max_length=BERT_MAX_LEN, padding=True,
                        truncation=True, return_tensors="pt").to(DEVICE)
        with torch.no_grad():
            all_preds.append(model(**enc).logits.argmax(1).cpu().numpy())
    del model; gc.collect(); torch.cuda.empty_cache()
    return np.concatenate(all_preds)


# ─────────────────────────────────────────────────────────────────────────────
# 6. EDGE-CASE SAMPLE SELECTION
# ─────────────────────────────────────────────────────────────────────────────
def select_edge_cases(texts, y_true, svm_preds, lstm_preds, bert_preds,
                      n=N_SAMPLES, seed=RANDOM_SEED):
    """
    Three-tier selection strategy to get the most informative 50 samples.

    Tier 1 (~60%): SVM wrong + BERT right   → showcases BERT's context understanding
    Tier 2 (~25%): All 3 wrong               → genuine hard / ambiguous cases
    Tier 3 (~15%): Random sample from critical classes (suicidal / depression / PD)
                   where at least 1 model erred

    Returns a DataFrame of selected samples.
    """
    rng = random.Random(seed)
    np.random.seed(seed)

    df = pd.DataFrame({
        "text"       : texts,
        "true_label" : [CLASS_NAMES[i] for i in y_true],
        "true_idx"   : y_true,
        "svm_pred"   : [CLASS_NAMES[i] for i in svm_preds],
        "lstm_pred"  : [CLASS_NAMES[i] for i in lstm_preds],
        "bert_pred"  : [CLASS_NAMES[i] for i in bert_preds],
    })

    svm_wrong  = svm_preds  != y_true
    lstm_wrong = lstm_preds != y_true
    bert_wrong = bert_preds != y_true
    bert_right = bert_preds == y_true
    all_wrong  = svm_wrong & lstm_wrong & bert_wrong
    is_critical = df["true_label"].isin(CRITICAL_CLASSES)

    # ── Tier 1: SVM wrong, BERT right (any class, prioritise critical) ──
    tier1_mask = svm_wrong & bert_right
    tier1_crit = df[tier1_mask & is_critical].index.tolist()
    tier1_rest = df[tier1_mask & ~is_critical].index.tolist()
    rng.shuffle(tier1_crit); rng.shuffle(tier1_rest)
    tier1_pool = tier1_crit + tier1_rest

    t1_n = int(n * 0.60)
    tier1_idx = tier1_pool[:t1_n]

    # ── Tier 2: All 3 wrong ─────────────────────────────────────────────
    tier2_pool = [i for i in df[all_wrong].index.tolist() if i not in tier1_idx]
    rng.shuffle(tier2_pool)
    t2_n = int(n * 0.25)
    tier2_idx = tier2_pool[:t2_n]

    # ── Tier 3: Critical class, at least 1 model wrong ──────────────────
    already_chosen = set(tier1_idx) | set(tier2_idx)
    one_wrong = svm_wrong | lstm_wrong | bert_wrong
    tier3_pool = [i for i in df[is_critical & one_wrong].index.tolist()
                  if i not in already_chosen]
    rng.shuffle(tier3_pool)
    t3_n = n - len(tier1_idx) - len(tier2_idx)
    tier3_idx = tier3_pool[:t3_n]

    all_idx = tier1_idx + tier2_idx + tier3_idx

    # Fill remaining slots with any unseen SVM-wrong cases
    if len(all_idx) < n:
        remaining = [i for i in df[svm_wrong].index.tolist() if i not in set(all_idx)]
        rng.shuffle(remaining)
        all_idx += remaining[:n - len(all_idx)]

    selected = df.loc[all_idx].copy().reset_index(drop=True)

    # Add tier label for transparency
    tier_map = {}
    for idx in tier1_idx: tier_map[idx] = "tier1_svm_wrong_bert_right"
    for idx in tier2_idx: tier_map[idx] = "tier2_all_models_wrong"
    for idx in tier3_idx: tier_map[idx] = "tier3_critical_class"
    selected["selection_tier"] = [tier_map.get(i, "tier4_fallback") for i in all_idx]

    # Correctness flags
    selected["svm_correct"]  = selected["svm_pred"]  == selected["true_label"]
    selected["lstm_correct"] = selected["lstm_pred"]  == selected["true_label"]
    selected["bert_correct"] = selected["bert_pred"]  == selected["true_label"]

    print(f"\n{'='*60}")
    print(f"SELECTED {len(selected)} EDGE-CASE SAMPLES")
    print(f"{'='*60}")
    tier_counts = selected["selection_tier"].value_counts()
    for tier, cnt in tier_counts.items():
        print(f"  {tier:40s}: {cnt}")
    print(f"\n  True-label distribution:")
    print(selected["true_label"].value_counts().to_string())
    return selected


# ─────────────────────────────────────────────────────────────────────────────
# 7. BUILD LLM PROMPTS
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert clinical psychologist and NLP evaluation specialist.
Your task is to assess mental health text classification predictions made by three AI models
(SVM, Bi-LSTM, BERT) and provide structured, evidence-based evaluations.

You will evaluate each sample on four dimensions:
1. **Clinical Accuracy** (0–10): Does the predicted label reflect the clinical/psychological meaning of the text?
2. **Linguistic Complexity** (Low/Medium/High): Does the text use metaphors, sarcasm, euphemisms, or indirect language?
3. **Missed Risk Signals** (0–10): How severe would the consequences be if a real system made this error?
4. **Model Reasoning Analysis**: Why do you think SVM failed but BERT succeeded (or all three failed)?

Always respond in the exact JSON schema provided."""

def build_prompt(row: pd.Series, sample_id: int) -> str:
    """Build a structured single-sample evaluation prompt."""
    prompt = f"""
## Sample #{sample_id + 1}

**Text to evaluate:**
"{row['text']}"

**Ground Truth Label:** `{row['true_label']}`

**Model Predictions:**
| Model   | Prediction          | Correct? |
|---------|---------------------|----------|
| SVM     | `{row['svm_pred']}` | {'✅' if row['svm_correct'] else '❌'} |
| Bi-LSTM | `{row['lstm_pred']}` | {'✅' if row['lstm_correct'] else '❌'} |
| BERT    | `{row['bert_pred']}` | {'✅' if row['bert_correct'] else '❌'} |

**Selection Reason:** {row['selection_tier'].replace('_', ' ').title()}

Please evaluate this sample and respond ONLY with the following JSON schema:

```json
{{
  "sample_id": {sample_id + 1},
  "ground_truth": "{row['true_label']}",
  "clinical_accuracy": {{
    "svm_score": <int 0-10>,
    "lstm_score": <int 0-10>,
    "bert_score": <int 0-10>
  }},
  "linguistic_complexity": "<Low|Medium|High>",
  "linguistic_features": ["<feature1>", "<feature2>"],
  "missed_risk_severity": <int 0-10>,
  "model_reasoning": "<2-3 sentences explaining WHY models succeeded or failed>",
  "clinical_insight": "<1-2 sentences from a psychologist's perspective>",
  "verdict": "<which model is most reliable for this sample and why>"
}}
```
""".strip()
    return prompt


def build_batch_prompt(selected_df: pd.DataFrame) -> str:
    """Build a single batch prompt with all 50 samples."""
    header = f"""{SYSTEM_PROMPT}

---

You will now evaluate {len(selected_df)} mental health text classification samples.
The 7 possible labels are: {', '.join(f'`{c}`' for c in CLASS_NAMES)}.

For each sample, respond with a JSON object following the schema shown in the first sample.
Wrap ALL responses in a top-level JSON array like:
```json
[
  {{ ... sample 1 ... }},
  {{ ... sample 2 ... }},
  ...
]
```

---
"""
    samples = "\n\n---\n\n".join(
        build_prompt(row, i) for i, row in selected_df.iterrows()
    )
    return header + samples


# ─────────────────────────────────────────────────────────────────────────────
# 8. OPTIONAL: AUTO-CALL GPT-4o
# ─────────────────────────────────────────────────────────────────────────────
def call_gpt4o(batch_prompt: str, api_key: str) -> dict:
    """
    Call GPT-4o API with the batch prompt.
    Returns parsed JSON list or raw text on parse failure.
    """
    try:
        from openai import OpenAI
    except ImportError:
        print("  openai package not found. Run: pip install openai")
        return {}

    client = OpenAI(api_key=api_key)
    print("  Sending request to GPT-4o ...")

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system",
             "content": "You are an expert clinical psychologist and NLP evaluation specialist."},
            {"role": "user", "content": batch_prompt},
        ],
        temperature=0.2,     # low temp → more consistent structured output
        max_tokens=16000,
        response_format={"type": "text"},
    )

    raw = response.choices[0].message.content
    # Try to extract JSON from response
    try:
        # Strip markdown fences if present
        clean = raw.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:])
            clean = clean.rstrip("`").strip()
        parsed = json.loads(clean)
        print(f"  ✓ GPT-4o returned {len(parsed)} evaluations")
        return {"status": "success", "evaluations": parsed, "raw": raw}
    except json.JSONDecodeError:
        print("  ⚠️  Could not parse JSON from GPT-4o; saving raw response")
        return {"status": "parse_error", "raw": raw}


def call_claude(batch_prompt: str, api_key: str) -> dict:
    """
    Call Anthropic Claude 3.5 Sonnet API with the batch prompt.
    Returns parsed JSON list or raw text on parse failure.
    """
    try:
        import anthropic
    except ImportError:
        print("  anthropic package not found. Run: pip install anthropic")
        return {}

    client = anthropic.Anthropic(api_key=api_key)
    print("  Sending request to Claude 3.5 Sonnet ...")

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=16000,
        messages=[{"role": "user", "content": batch_prompt}],
    )

    raw = message.content[0].text
    try:
        clean = raw.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:])
            clean = clean.rstrip("`").strip()
        parsed = json.loads(clean)
        print(f"  ✓ Claude returned {len(parsed)} evaluations")
        return {"status": "success", "evaluations": parsed, "raw": raw}
    except json.JSONDecodeError:
        print("  ⚠️  Could not parse JSON from Claude; saving raw response")
        return {"status": "parse_error", "raw": raw}


# ─────────────────────────────────────────────────────────────────────────────
# 9. SAVE OUTPUTS
# ─────────────────────────────────────────────────────────────────────────────
def save_outputs(selected_df: pd.DataFrame, batch_prompt: str,
                 llm_result: dict, output_dir: Path):

    # (a) Selected samples CSV
    csv_path = output_dir / "llm_judge_samples.csv"
    selected_df.to_csv(csv_path, index=False)
    print(f"\n  ✓ Samples CSV     : {csv_path}")

    # (b) Full batch prompt text  (for manual submission)
    prompt_path = output_dir / "llm_judge_batch_prompt.txt"
    prompt_path.write_text(batch_prompt, encoding="utf-8")
    print(f"  ✓ Batch prompt    : {prompt_path}")

    # (c) Individual prompt JSONL  (one record per sample)
    jsonl_path = output_dir / "llm_judge_prompts.jsonl"
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for i, row in selected_df.iterrows():
            record = {
                "sample_id"      : int(i) + 1,
                "ground_truth"   : row["true_label"],
                "svm_pred"       : row["svm_pred"],
                "lstm_pred"      : row["lstm_pred"],
                "bert_pred"      : row["bert_pred"],
                "selection_tier" : row["selection_tier"],
                "text"           : row["text"],
                "prompt"         : build_prompt(row, i),
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"  ✓ Prompts JSONL   : {jsonl_path}")

    # (d) LLM evaluations (if available)
    if llm_result:
        result_path = output_dir / "llm_judge_results.json"
        result_path.write_text(json.dumps(llm_result, indent=2, ensure_ascii=False),
                                encoding="utf-8")
        print(f"  ✓ LLM results     : {result_path}")

        # Flatten to CSV if parsed successfully
        if llm_result.get("status") == "success":
            evals = llm_result["evaluations"]
            flat = []
            for ev in evals:
                ca = ev.get("clinical_accuracy", {})
                flat.append({
                    "sample_id"            : ev.get("sample_id"),
                    "ground_truth"         : ev.get("ground_truth"),
                    "linguistic_complexity": ev.get("linguistic_complexity"),
                    "missed_risk_severity" : ev.get("missed_risk_severity"),
                    "svm_clinical_score"   : ca.get("svm_score"),
                    "lstm_clinical_score"  : ca.get("lstm_score"),
                    "bert_clinical_score"  : ca.get("bert_score"),
                    "linguistic_features"  : "; ".join(ev.get("linguistic_features", [])),
                    "model_reasoning"      : ev.get("model_reasoning"),
                    "clinical_insight"     : ev.get("clinical_insight"),
                    "verdict"              : ev.get("verdict"),
                })
            eval_df = pd.DataFrame(flat)
            eval_csv = output_dir / "llm_judge_results_flat.csv"
            eval_df.to_csv(eval_csv, index=False)
            print(f"  ✓ LLM flat CSV    : {eval_csv}")

            # Quick aggregate
            print("\n  📊 LLM Evaluation Aggregate (mean clinical accuracy):")
            for model in ["svm", "lstm", "bert"]:
                col = f"{model}_clinical_score"
                if col in eval_df.columns:
                    mean_score = eval_df[col].mean()
                    print(f"    {model.upper():8s}: {mean_score:.2f}/10")


# ─────────────────────────────────────────────────────────────────────────────
# 10. MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "🧠 " * 20)
    print("LLM-AS-A-JUDGE — MENTAL HEALTH NLP EVALUATION")
    print("🧠 " * 20 + "\n")

    # ── Load data ──────────────────────────────────────────────────────────
    X_test, y_test, label_mapping, test_df, text_col = load_data()
    texts = test_df[text_col].fillna("").tolist()

    # ── Run models ─────────────────────────────────────────────────────────
    print("\n[Step 1] Running model inference ...")
    svm_preds  = run_svm(X_test)
    lstm_preds = run_bilstm(X_test)
    bert_preds = run_bert(texts)

    # Align lengths
    n = min(len(y_test), len(svm_preds), len(lstm_preds), len(bert_preds))
    y_test     = y_test[:n]
    svm_preds  = svm_preds[:n]
    lstm_preds = lstm_preds[:n]
    bert_preds = bert_preds[:n]
    texts      = texts[:n]

    # ── Select edge cases ──────────────────────────────────────────────────
    print("\n[Step 2] Selecting 50 edge-case samples ...")
    selected_df = select_edge_cases(texts, y_test, svm_preds, lstm_preds, bert_preds)

    # ── Build prompts ──────────────────────────────────────────────────────
    print("\n[Step 3] Building LLM prompts ...")
    batch_prompt = build_batch_prompt(selected_df)
    print(f"  Batch prompt length: {len(batch_prompt):,} characters")

    # ── Optional: call LLM automatically if API key present ───────────────
    llm_result = {}
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    claude_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if openai_key:
        print("\n[Step 4] OPENAI_API_KEY detected — calling GPT-4o ...")
        llm_result = call_gpt4o(batch_prompt, openai_key)
    elif claude_key:
        print("\n[Step 4] ANTHROPIC_API_KEY detected — calling Claude 3.5 Sonnet ...")
        llm_result = call_claude(batch_prompt, claude_key)
    else:
        print("\n[Step 4] No API key found in environment.")
        print("  → Set OPENAI_API_KEY or ANTHROPIC_API_KEY as a Kaggle Secret,")
        print("    or use the saved prompt files for manual submission.")

    # ── Save everything ────────────────────────────────────────────────────
    print("\n[Step 5] Saving outputs ...")
    save_outputs(selected_df, batch_prompt, llm_result, OUTPUT_DIR)

    print("\n✅ LLM-AS-A-JUDGE PIPELINE COMPLETE")
    print(f"   All outputs saved to: {OUTPUT_DIR}")
    print("""
╔══════════════════════════════════════════════════════════╗
║  NEXT STEPS (if running LLM manually)                  ║
║                                                          ║
║  1. Open:  llm_judge_batch_prompt.txt                   ║
║  2. Paste into GPT-4o / Claude chat                     ║
║  3. Save the JSON response to a file                    ║
║  4. Use llm_judge_prompts.jsonl for per-sample control  ║
╚══════════════════════════════════════════════════════════╝
""")


if __name__ == "__main__":
    main()
