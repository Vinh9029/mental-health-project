# A Machine Learning Approach to Psychological Disorder Screening and Virtual Assistant for Mental Health Support ("MindCare AI")

<div align="center">
  <img width="1729" height="843" alt="image" src="https://github.com/user-attachments/assets/8e0db8b5-10c4-482f-8015-c4009eeb5242" />

</div>

---

## 📖 Project Overview

Mental health disorders are a growing global challenge, often exacerbated by the stigma surrounding mental illness and the lack of accessible professional care. This project introduces an end-to-end, AI-powered mental health support system designed to bridge this gap. 

By combining **Natural Language Processing (NLP)** for preliminary screening and **Retrieval-Augmented Generation (RAG)** for safe, empathetic intervention, this system acts as a secure, 24/7 accessible first line of psychological support. The entire architecture strictly adheres to the **MIND-SAFE** ethical framework to ensure clinical safety and data privacy.

## ✨ Key Features & System Architecture

Our system operates through a seamless 5-layer pipeline:

1. **Active Clinical Screening:** Utilizes standardized psychometric scales (**PHQ-9** for depression and **GAD-7** for anxiety) to establish a baseline severity profile (Normal, Mild, Moderate, Severe).
2. **Passive NLP Inference (BERT):** A fine-tuned **BERT model** analyzes user text in real-time, capturing bidirectional context to classify text into 7 mental health states *(Anxiety, Bipolar, Depression, Normal, Personality Disorder, Stress, Suicidal)* with an accuracy of **83.6%**.
3. **Hybrid Profile Fusion:** Intelligently merges the 2-week active baseline with real-time NLP predictions to create a comprehensive "Assessment Overview", handling any modality conflicts dynamically.
4. **RAG Therapeutic Chatbot:** Grounded in a verified Vector Database of Cognitive Behavioral Therapy (CBT) manuals, preventing dangerous LLM "hallucinations" while delivering highly personalized coping strategies.
5. **Deterministic Crisis Override:** A hardcoded safety gate that immediately bypasses the generative LLM if the `Suicidal` label or high-risk keywords are detected, triggering an emergency protocol with hotline resources.

## 🛠️ Tech Stack

*   **Machine Learning / NLP:** Python, HuggingFace Transformers (BERT), Scikit-Learn (SVM), TensorFlow/Keras (Bi-LSTM).
*   **Generative AI:** Large Language Models (LLM API), LangChain, ChromaDB (Vector Database).
*   **Backend:** FastAPI (Python).
*   **Frontend:** React.js / Next.js, TailwindCSS.

## 📊 Evaluation & Metrics
The models were trained on a highly imbalanced social media dataset. To ensure clinical reliability, the evaluation goes beyond standard Accuracy. We prioritized **Macro-F1 Score** and **Recall (Sensitivity)** to minimize false negatives in critical classes (e.g., *Suicidal*). Furthermore, we integrated an innovative **LLM-as-a-Judge** methodology to qualitatively evaluate the clinical explainability of the BERT model's predictions.

---

## 🖼️ Project Poster

Curious to see the visual summary of our research and architecture? 
<img width="2245" height="3179" alt="Poster dự án CNTT Botnet (Share)" src="https://github.com/user-attachments/assets/572778fa-290b-4e96-a616-eec236a37289" />

<br/>

> **Disclaimer:** *This system is developed for academic and research purposes. It is designed to provide preliminary screening and self-care support, not to replace professional medical diagnosis or human therapists.*
