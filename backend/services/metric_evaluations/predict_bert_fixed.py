# =============================================================================
# FIXED predict_bert() — Copy toàn bộ function này vào notebook cell trên Kaggle
#
# Dataset paths trong Kaggle của bạn:
#   BERT model  : /kaggle/input/datasets/dx9029/model_bert/
#   SVM + LSTM  : /kaggle/input/datasets/dx9029/mental-health-models/
#
# Root cause của lỗi:
#   1. OSError / HFValidationError — HF validator reject absolute path có nhiều
#      dấu '/' vì nó nghĩ đó là repo_id (phải có dạng "namespace/repo_name")
#   2. GatedRepoError 401 — fallback sang "mental/mental-bert-base-uncased"
#      là Gated Repo, cần accept terms + HF token mới download được
#
# Fix:
#   - Dùng local_files_only=True → bắt buộc load từ disk, bỏ qua HF validator
#   - Glob-search config.json để tìm đúng subfolder chứa model
#   - Fallback công khai "bert-base-uncased" (không gated, không cần token)
# =============================================================================

def predict_bert(test_df, text_col="statement"):
    """Load saved BERT model and return hard predictions + softmax probs."""

    # ── Step 1: Locate the trained BERT model files ───────────────────────────
    # Your BERT model is stored in Kaggle dataset: dx9029/model_bert
    BERT_MODEL_DIR = Path("/kaggle/input/datasets/dx9029/model_bert")

    # Try candidate subfolders in priority order
    # (a valid BERT checkpoint directory MUST have config.json inside)
    candidate_paths = [
        BERT_MODEL_DIR / "bert_model_full",     # ← most common save pattern
        BERT_MODEL_DIR / "mental-bert-base-uncased",  # ← if saved with this name
        BERT_MODEL_DIR,                          # ← model files at dataset root
    ]

    bert_path = None
    for cand in candidate_paths:
        if (cand / "config.json").exists():
            bert_path = cand
            print(f"  ✓ Found BERT model at: {bert_path}")
            break

    # Glob-search as a last resort (catches any unexpected subfolder name)
    if bert_path is None:
        config_files = sorted(BERT_MODEL_DIR.glob("**/config.json"))
        if config_files:
            bert_path = config_files[0].parent
            print(f"  ✓ Found BERT model via glob: {bert_path}")
        else:
            print(f"  ❌ No config.json found under {BERT_MODEL_DIR}")
            print(f"     Directory listing: {list(BERT_MODEL_DIR.iterdir()) if BERT_MODEL_DIR.exists() else 'PATH DOES NOT EXIST'}")

    # ── Step 2: Load tokenizer + model ───────────────────────────────────────
    if bert_path is not None:
        print(f"  Loading BERT from local path: {bert_path}")
        try:
            # KEY FIX: local_files_only=True forces transformers to treat the
            # argument as a filesystem path, bypassing HuggingFace's repo_id
            # validator that rejects absolute paths with multiple '/' slashes.
            tokenizer = AutoTokenizer.from_pretrained(
                str(bert_path),
                local_files_only=True,
            )
            model = AutoModelForSequenceClassification.from_pretrained(
                str(bert_path),
                num_labels=NUM_CLASSES,
                local_files_only=True,
                ignore_mismatched_sizes=True,  # safe if num_labels differs
            ).to(DEVICE)
            print(f"  ✓ BERT loaded successfully from local path.")

        except Exception as local_err:
            print(f"  ⚠️ Local load failed: {local_err}")
            bert_path = None  # trigger public fallback below

    if bert_path is None:
        # ── Public fallback — no token needed ────────────────────────────────
        # "bert-base-uncased" is freely available on HuggingFace (not gated).
        # WARNING: this is an UNTRAINED base model — metrics will be near-random.
        # To fix properly, ensure the model files exist at BERT_MODEL_DIR.
        fallback_id = "bert-base-uncased"
        print(f"\n  ⚠️  WARNING: No local BERT model found.")
        print(f"     Falling back to public base model: '{fallback_id}'")
        print(f"     Metrics for BERT will NOT reflect your fine-tuned model!\n")
        tokenizer = AutoTokenizer.from_pretrained(fallback_id)
        model = AutoModelForSequenceClassification.from_pretrained(
            fallback_id, num_labels=NUM_CLASSES
        ).to(DEVICE)

    model.eval()

    # ── Step 3: Batch inference ───────────────────────────────────────────────
    texts_list = test_df[text_col].fillna("").tolist()
    all_probs, all_preds = [], []

    for i in range(0, len(texts_list), BERT_BATCH_SIZE):
        batch_texts = texts_list[i : i + BERT_BATCH_SIZE]
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
            print(f"    BERT progress: {min(i + BERT_BATCH_SIZE, len(texts_list))}/{len(texts_list)}")

    del model
    gc.collect()
    torch.cuda.empty_cache()
    return np.concatenate(all_preds), np.concatenate(all_probs)
