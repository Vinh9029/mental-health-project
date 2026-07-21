"""
=============================================================================
QUANTITATIVE EVALUATION - Mental Health NLP Models
=============================================================================
Metrics: Recall (per-class), Macro-F1, PR-AUC (Precision-Recall AUC)
Models:  SVM, Bi-LSTM, BERT
Dataset: 7-class imbalanced mental health dataset (~103K samples)

Run on Kaggle:
  - Input dataset:  /kaggle/input/datasets/dx9029/mental-health/
  - Input models:   /kaggle/input/<your-models-dataset>/
  - Output:         /kaggle/working/
=============================================================================
"""

# ─────────────────────────────────────────────────────────────────────────────
# 1. IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
import os
import gc
import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")           # headless on Kaggle
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from sklearn.svm import LinearSVC
from sklearn.preprocessing import label_binarize
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    recall_score,
    precision_score,
    classification_report,
    confusion_matrix,
    precision_recall_curve,
    average_precision_score,
)

from transformers import AutoTokenizer, AutoModelForSequenceClassification

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# 2. PATHS  ← adjust dataset slugs as needed
# ─────────────────────────────────────────────────────────────────────────────
DATA_DIR   = Path("/kaggle/input/datasets/dx9029/mental-health")
MODEL_DIR  = Path("/kaggle/input/mental-health-models")   # your saved models dataset
OUTPUT_DIR = Path("/kaggle/working")
OUTPUT_DIR.mkdir(exist_ok=True)

BERT_MODEL_NAME = "mental-bert-base-uncased"   # local path inside MODEL_DIR or HF hub name
BERT_MAX_LEN    = 128
BERT_BATCH_SIZE = 64
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

CLASS_NAMES = ["anxiety", "bipolar", "depression", "normal",
               "personality disorder", "stress", "suicidal"]
NUM_CLASSES = len(CLASS_NAMES)

# ─────────────────────────────────────────────────────────────────────────────
# 3. LOAD PREPROCESSED DATA
# ─────────────────────────────────────────────────────────────────────────────
def load_data():
    print("=" * 70)
    print("LOADING PREPROCESSED FEATURES")
    print("=" * 70)

    with open(DATA_DIR / "X_test_scaled.pkl", "rb") as f:
        X_test = pickle.load(f)
    with open(DATA_DIR / "y_test.pkl", "rb") as f:
        y_test = pickle.load(f)
    with open(DATA_DIR / "label_mapping.pkl", "rb") as f:
        label_mapping = pickle.load(f)
    # Raw text needed for BERT
    test_df = pd.read_csv(DATA_DIR / "test_processed.csv")

    print(f"✓ X_test shape : {X_test.shape}")
    print(f"✓ y_test shape : {y_test.shape}")
    print(f"✓ Classes      : {label_mapping}")
    print(f"✓ Text samples : {len(test_df)}")
    print()
    return X_test, y_test, label_mapping, test_df


# ─────────────────────────────────────────────────────────────────────────────
# 4. BI-LSTM ARCHITECTURE (must match training definition)
# ─────────────────────────────────────────────────────────────────────────────
class BiLSTMClassifier(nn.Module):
    def __init__(self, input_size, hidden_size=256, num_layers=3,
                 num_classes=7, dropout=0.4):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout,
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 512), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(512, 256),            nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


# ─────────────────────────────────────────────────────────────────────────────
# 5. PREDICTION HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def predict_svm(X_test):
    """Load saved SVM and return hard predictions."""
    svm_path = MODEL_DIR / "svm_model_full.pkl"
    print(f"  Loading SVM from {svm_path}")
    with open(svm_path, "rb") as f:
        model = pickle.load(f)
    preds = model.predict(X_test)
    # LinearSVC has decision_function but no predict_proba;
    # use calibrated scores for PR-AUC
    scores = model.decision_function(X_test)   # shape (n, 7)
    del model; gc.collect()
    return preds, scores


def predict_bilstm(X_test):
    """Load saved Bi-LSTM and return hard predictions + softmax probabilities."""
    lstm_path = MODEL_DIR / "lstm_model_full.pt"
    print(f"  Loading Bi-LSTM from {lstm_path}")

    X_tensor = torch.FloatTensor(
        X_test.toarray() if hasattr(X_test, "toarray") else X_test
    ).unsqueeze(1)   # (N, 1, 300)

    model = BiLSTMClassifier(input_size=X_tensor.shape[2]).to(DEVICE)
    model.load_state_dict(torch.load(lstm_path, map_location=DEVICE))
    model.eval()

    loader = DataLoader(TensorDataset(X_tensor), batch_size=256, shuffle=False)
    all_probs, all_preds = [], []

    with torch.no_grad():
        for (batch,) in loader:
            logits = model(batch.to(DEVICE))
            probs  = torch.softmax(logits, dim=1).cpu().numpy()
            preds  = logits.argmax(1).cpu().numpy()
            all_probs.append(probs)
            all_preds.append(preds)

    del model; gc.collect(); torch.cuda.empty_cache()
    return np.concatenate(all_preds), np.concatenate(all_probs)


def predict_bert(test_df, text_col="statement"):
    """Load saved BERT model and return hard predictions + softmax probs."""
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

    print(f"  Loading BERT from {bert_path}")

    tokenizer = AutoTokenizer.from_pretrained(str(bert_path))
    model = AutoModelForSequenceClassification.from_pretrained(
        str(bert_path), num_labels=NUM_CLASSES
    ).to(DEVICE)
    model.eval()

    texts = test_df[text_col].fillna("").tolist()
    all_probs, all_preds = [], []

    for i in range(0, len(texts), BERT_BATCH_SIZE):
        batch_texts = texts[i : i + BERT_BATCH_SIZE]
        enc = tokenizer(
            batch_texts,
            max_length=BERT_MAX_LEN,
            padding=True,
            truncation=True,
            return_tensors="pt",
        ).to(DEVICE)
        with torch.no_grad():
            logits = model(**enc).logits
        probs = torch.softmax(logits, dim=1).cpu().numpy()
        preds = logits.argmax(1).cpu().numpy()
        all_probs.append(probs)
        all_preds.append(preds)
        if (i // BERT_BATCH_SIZE) % 20 == 0:
            print(f"    BERT progress: {min(i+BERT_BATCH_SIZE, len(texts))}/{len(texts)}")

    del model; gc.collect(); torch.cuda.empty_cache()
    return np.concatenate(all_preds), np.concatenate(all_probs)


# ─────────────────────────────────────────────────────────────────────────────
# 6. METRICS COMPUTATION
# ─────────────────────────────────────────────────────────────────────────────
def compute_pr_auc(y_true, y_scores):
    """
    Compute per-class and macro PR-AUC for multi-class.
    y_scores: (N, C) probability / decision-function scores.
    """
    y_bin = label_binarize(y_true, classes=list(range(NUM_CLASSES)))

    # Normalize decision scores to [0,1] range if needed (e.g. LinearSVC)
    if y_scores.min() < 0 or y_scores.max() > 1:
        from sklearn.preprocessing import MinMaxScaler
        y_scores = MinMaxScaler().fit_transform(y_scores)

    pr_auc_per_class = {}
    for i, name in enumerate(CLASS_NAMES):
        ap = average_precision_score(y_bin[:, i], y_scores[:, i])
        pr_auc_per_class[name] = ap

    macro_pr_auc = np.mean(list(pr_auc_per_class.values()))
    return pr_auc_per_class, macro_pr_auc


def evaluate_model(model_name, y_true, y_pred, y_scores):
    """Compute and return a dict of all required metrics."""
    print(f"\n{'='*70}")
    print(f"EVALUATION: {model_name}")
    print(f"{'='*70}")

    acc       = accuracy_score(y_true, y_pred)
    macro_f1  = f1_score(y_true, y_pred, average="macro", zero_division=0)
    w_f1      = f1_score(y_true, y_pred, average="weighted", zero_division=0)
    recall_per_class = recall_score(y_true, y_pred, average=None, zero_division=0)
    prec_per_class   = precision_score(y_true, y_pred, average=None, zero_division=0)
    pr_auc_per_class, macro_pr_auc = compute_pr_auc(y_true, y_scores)

    results = {
        "model"           : model_name,
        "accuracy"        : acc,
        "macro_f1"        : macro_f1,
        "weighted_f1"     : w_f1,
        "macro_pr_auc"    : macro_pr_auc,
    }

    for i, name in enumerate(CLASS_NAMES):
        results[f"recall_{name}"]  = recall_per_class[i]
        results[f"prec_{name}"]    = prec_per_class[i]
        results[f"pr_auc_{name}"]  = pr_auc_per_class[name]

    # Console summary
    print(f"  Accuracy       : {acc:.4f}")
    print(f"  Macro-F1       : {macro_f1:.4f}")
    print(f"  Weighted-F1    : {w_f1:.4f}")
    print(f"  Macro PR-AUC   : {macro_pr_auc:.4f}")
    print(f"\n  Per-class Recall:")
    for i, name in enumerate(CLASS_NAMES):
        flag = " ⚠️" if name in ("suicidal", "depression") else ""
        print(f"    {name:25s}: Recall={recall_per_class[i]:.4f}  PR-AUC={pr_auc_per_class[name]:.4f}{flag}")

    print(f"\n  Classification Report:")
    print(classification_report(y_true, y_pred, target_names=CLASS_NAMES, zero_division=0))

    return results


# ─────────────────────────────────────────────────────────────────────────────
# 7. VISUALISATION
# ─────────────────────────────────────────────────────────────────────────────
PALETTE = {"SVM": "#4C72B0", "Bi-LSTM": "#55A868", "BERT": "#C44E52"}

def plot_comparison_bar(df_summary, output_dir):
    """Bar chart: Accuracy, Macro-F1, Macro-PR-AUC side-by-side per model."""
    metrics = ["accuracy", "macro_f1", "macro_pr_auc"]
    labels  = ["Accuracy", "Macro F1-Score", "Macro PR-AUC"]
    x = np.arange(len(metrics))
    width = 0.22
    colors = [PALETTE[m] for m in df_summary["model"]]

    fig, ax = plt.subplots(figsize=(10, 6))
    for i, (_, row) in enumerate(df_summary.iterrows()):
        vals = [row[m] for m in metrics]
        bars = ax.bar(x + i * width, vals, width, label=row["model"],
                      color=list(PALETTE.values())[i], alpha=0.9, edgecolor="white")
        for bar, val in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.005,
                    f"{val:.3f}", ha="center", va="bottom", fontsize=8, fontweight="bold")

    ax.set_xticks(x + width)
    ax.set_xticklabels(labels, fontsize=11)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Score", fontsize=12)
    ax.set_title("Model Comparison — Key Metrics", fontsize=14, fontweight="bold", pad=15)
    ax.legend(fontsize=10)
    ax.grid(axis="y", alpha=0.3, linestyle="--")
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    path = output_dir / "01_metric_comparison.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved: {path}")


def plot_recall_heatmap(df_summary, output_dir):
    """Heatmap of per-class Recall for all 3 models."""
    recall_cols = [f"recall_{c}" for c in CLASS_NAMES]
    data = df_summary.set_index("model")[recall_cols]
    data.columns = CLASS_NAMES

    fig, ax = plt.subplots(figsize=(12, 4))
    sns.heatmap(
        data.astype(float), annot=True, fmt=".3f", cmap="RdYlGn",
        vmin=0, vmax=1, linewidths=0.5, ax=ax,
        annot_kws={"size": 10, "weight": "bold"},
        cbar_kws={"shrink": 0.8}
    )
    ax.set_title("Per-Class Recall — SVM vs Bi-LSTM vs BERT", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Mental Health Category", fontsize=11)
    ax.set_ylabel("Model", fontsize=11)
    ax.tick_params(axis="x", rotation=30)
    ax.tick_params(axis="y", rotation=0)

    # Highlight critical classes
    for j, name in enumerate(CLASS_NAMES):
        if name in ("suicidal", "depression"):
            ax.add_patch(plt.Rectangle((j, 0), 1, len(df_summary),
                                       fill=False, edgecolor="gold", lw=2.5))

    plt.tight_layout()
    path = output_dir / "02_recall_heatmap.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved: {path}")


def plot_pr_auc_heatmap(df_summary, output_dir):
    """Heatmap of per-class PR-AUC for all 3 models."""
    cols = [f"pr_auc_{c}" for c in CLASS_NAMES]
    data = df_summary.set_index("model")[cols]
    data.columns = CLASS_NAMES

    fig, ax = plt.subplots(figsize=(12, 4))
    sns.heatmap(
        data.astype(float), annot=True, fmt=".3f", cmap="Blues",
        vmin=0, vmax=1, linewidths=0.5, ax=ax,
        annot_kws={"size": 10},
        cbar_kws={"shrink": 0.8}
    )
    ax.set_title("Per-Class PR-AUC — SVM vs Bi-LSTM vs BERT", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Mental Health Category", fontsize=11)
    ax.set_ylabel("Model", fontsize=11)
    ax.tick_params(axis="x", rotation=30)
    ax.tick_params(axis="y", rotation=0)
    plt.tight_layout()
    path = output_dir / "03_pr_auc_heatmap.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved: {path}")


def plot_pr_curves(all_scores, y_true, output_dir):
    """
    Precision-Recall curves for critical classes (Suicidal & Depression)
    overlaid for all 3 models.
    """
    y_bin = label_binarize(y_true, classes=list(range(NUM_CLASSES)))
    critical = {"suicidal": 6, "depression": 2}

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    for ax, (cls_name, cls_idx) in zip(axes, critical.items()):
        for model_name, scores in all_scores.items():
            s = scores.copy()
            if s.min() < 0 or s.max() > 1:
                from sklearn.preprocessing import MinMaxScaler
                s = MinMaxScaler().fit_transform(s)
            prec, rec, _ = precision_recall_curve(y_bin[:, cls_idx], s[:, cls_idx])
            ap = average_precision_score(y_bin[:, cls_idx], s[:, cls_idx])
            ax.plot(rec, prec, label=f"{model_name} (AP={ap:.3f})",
                    color=PALETTE[model_name], linewidth=2)

        ax.set_xlabel("Recall", fontsize=11)
        ax.set_ylabel("Precision", fontsize=11)
        ax.set_title(f"PR Curve — {cls_name.capitalize()}", fontsize=12, fontweight="bold")
        ax.legend(fontsize=9)
        ax.set_xlim([0, 1]); ax.set_ylim([0, 1.05])
        ax.grid(alpha=0.3, linestyle="--")
        ax.spines[["top", "right"]].set_visible(False)

    plt.suptitle("Precision-Recall Curves for Critical Classes", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()
    path = output_dir / "04_pr_curves_critical.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved: {path}")


def plot_confusion_matrices(all_preds, y_true, output_dir):
    """3-panel confusion matrices (normalised)."""
    fig, axes = plt.subplots(1, 3, figsize=(20, 6))
    short_names = ["Anx", "Bip", "Dep", "Nor", "PD", "Str", "Sui"]

    for ax, (model_name, y_pred) in zip(axes, all_preds.items()):
        cm = confusion_matrix(y_true, y_pred, normalize="true")
        sns.heatmap(cm, annot=True, fmt=".2f", cmap="Blues",
                    xticklabels=short_names, yticklabels=short_names,
                    ax=ax, cbar=False, annot_kws={"size": 8})
        ax.set_title(f"{model_name}\n(row-normalised)", fontsize=11, fontweight="bold")
        ax.set_xlabel("Predicted", fontsize=9)
        ax.set_ylabel("True", fontsize=9)

    plt.suptitle("Confusion Matrices — SVM vs Bi-LSTM vs BERT", fontsize=14, fontweight="bold")
    plt.tight_layout()
    path = output_dir / "05_confusion_matrices.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved: {path}")


def plot_critical_recall_bar(df_summary, output_dir):
    """
    Grouped bar: Suicidal + Depression Recall for the 3 models.
    Key clinical insight chart.
    """
    classes  = ["suicidal", "depression"]
    x = np.arange(len(classes))
    width = 0.25

    fig, ax = plt.subplots(figsize=(8, 5))
    for i, (_, row) in enumerate(df_summary.iterrows()):
        vals = [row[f"recall_{c}"] for c in classes]
        bars = ax.bar(x + i * width, vals, width,
                      label=row["model"], color=list(PALETTE.values())[i],
                      alpha=0.9, edgecolor="white")
        for bar, val in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.005,
                    f"{val:.3f}", ha="center", va="bottom", fontsize=9, fontweight="bold")

    ax.set_xticks(x + width)
    ax.set_xticklabels(["Suicidal Recall", "Depression Recall"], fontsize=12)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Recall (Sensitivity)", fontsize=12)
    ax.set_title("Critical Class Recall — Suicidal & Depression\n"
                 "(Higher = Fewer dangerous false negatives)", fontsize=12, fontweight="bold")
    ax.legend(fontsize=10)
    ax.axhline(0.7, color="orange", linestyle="--", linewidth=1.2, label="70% threshold")
    ax.grid(axis="y", alpha=0.3, linestyle="--")
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    path = output_dir / "06_critical_recall.png"
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Saved: {path}")


# ─────────────────────────────────────────────────────────────────────────────
# 8. SAVE RESULTS
# ─────────────────────────────────────────────────────────────────────────────
def save_results(all_results, output_dir):
    df = pd.DataFrame(all_results)
    csv_path = output_dir / "quantitative_results.csv"
    df.to_csv(csv_path, index=False)
    print(f"\n✓ Results table saved: {csv_path}")

    # Pretty summary table
    summary_cols = ["model", "accuracy", "macro_f1", "weighted_f1", "macro_pr_auc",
                    "recall_suicidal", "recall_depression",
                    "pr_auc_suicidal", "pr_auc_depression"]
    print("\n" + "="*90)
    print("FINAL COMPARISON TABLE")
    print("="*90)
    print(df[summary_cols].to_string(index=False, float_format=lambda x: f"{x:.4f}"))
    print("="*90)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 9. MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "🔬 "*20)
    print("MENTAL HEALTH NLP — QUANTITATIVE EVALUATION")
    print("🔬 "*20 + "\n")

    # ── Load data ──────────────────────────────────────────────────────────
    X_test, y_test, label_mapping, test_df = load_data()

    # ── SVM ────────────────────────────────────────────────────────────────
    print("\n[1/3] SVM ...")
    svm_preds, svm_scores = predict_svm(X_test)

    # ── Bi-LSTM ────────────────────────────────────────────────────────────
    print("\n[2/3] Bi-LSTM ...")
    lstm_preds, lstm_scores = predict_bilstm(X_test)

    # ── BERT ───────────────────────────────────────────────────────────────
    print("\n[3/3] BERT ...")
    # Detect text column name flexibly
    text_col = "statement" if "statement" in test_df.columns else test_df.columns[0]
    bert_preds, bert_scores = predict_bert(test_df, text_col=text_col)

    # ── Align lengths (BERT uses raw text, others use X_test) ──────────────
    n = min(len(y_test), len(svm_preds), len(lstm_preds), len(bert_preds))
    y_test      = np.array(y_test)[:n]
    svm_preds   = svm_preds[:n];   svm_scores  = svm_scores[:n]
    lstm_preds  = lstm_preds[:n];  lstm_scores = lstm_scores[:n]
    bert_preds  = bert_preds[:n];  bert_scores = bert_scores[:n]

    # ── Evaluate ───────────────────────────────────────────────────────────
    all_results = []
    all_results.append(evaluate_model("SVM",     y_test, svm_preds,  svm_scores))
    all_results.append(evaluate_model("Bi-LSTM", y_test, lstm_preds, lstm_scores))
    all_results.append(evaluate_model("BERT",    y_test, bert_preds, bert_scores))

    # ── Summary table ──────────────────────────────────────────────────────
    df_summary = save_results(all_results, OUTPUT_DIR)

    # ── Visualisations ─────────────────────────────────────────────────────
    print("\n📊 Generating visualisations ...")
    all_preds_dict  = {"SVM": svm_preds,  "Bi-LSTM": lstm_preds, "BERT": bert_preds}
    all_scores_dict = {"SVM": svm_scores, "Bi-LSTM": lstm_scores, "BERT": bert_scores}

    plot_comparison_bar(df_summary, OUTPUT_DIR)
    plot_recall_heatmap(df_summary, OUTPUT_DIR)
    plot_pr_auc_heatmap(df_summary, OUTPUT_DIR)
    plot_pr_curves(all_scores_dict, y_test, OUTPUT_DIR)
    plot_confusion_matrices(all_preds_dict, y_test, OUTPUT_DIR)
    plot_critical_recall_bar(df_summary, OUTPUT_DIR)

    print("\n✅ EVALUATION COMPLETE")
    print(f"   All outputs saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
