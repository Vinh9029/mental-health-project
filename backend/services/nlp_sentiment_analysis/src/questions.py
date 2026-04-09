# =====================================================================
# MODULE: ASSESSMENT QUESTIONS (PHQ-9 & GAD-7 & Conversation)
# =====================================================================

# 1. ANSWER OPTIONS (0-3 Likert Scale)
ANSWER_OPTIONS = {
    0: "Not at all (Không chút nào)",
    1: "Several days (Vài ngày)",
    2: "More than half the days (Hơn một nửa số ngày)",
    3: "Nearly every day (Gần như mỗi ngày)"
}

# =====================================================================
# 2. PHQ-9 QUESTIONS (Depression Screening - 9 questions)
# =====================================================================
PHQ9_QUESTIONS = [
    "Little interest or pleasure in doing things?\n(Bạn có cảm thấy ít hứng thú hoặc niềm vui khi làm việc gì đó không?)    ",
    "Feeling down, depressed, or hopeless?\n(Bạn có cảm thấy buồn bã, chán nản hoặc tuyệt vọng không?)",
    "Trouble falling or staying asleep, or sleeping too much?\n(Bạn có gặp khó khăn khi đi vào giấc ngủ, duy trì giấc ngủ, hoặc ngủ quá nhiều không?)",
    "Feeling tired or having little energy?\n(Bạn có cảm thấy mệt mỏi hoặc thiếu năng lượng không?)",
    "Poor appetite or overeating?\n (Bạn có cảm thấy chán ăn hoặc ăn quá nhiều không?)",
    "Feeling bad about yourself — or that you are a failure or have let yourself or your family down?\n(Bạn có cảm thấy tệ về bản thân - hoặc rằng bạn là một thất bại hoặc đã làm bản thân hoặc gia đình thất vọng không?)",
    "Trouble concentrating on things, such as reading the newspaper or watching television?\n(Bạn có gặp khó khăn khi tập trung vào việc gì đó, như đọc báo hoặc xem ti vi không?)",
    "Moving or speaking so slowly that other people could have noticed? Or so fidgety or restless that you have been moving a lot more than usual?\n(Bạn có di chuyển hoặc nói chậm đến mức người khác có thể nhận thấy? Hoặc quá bất an hoặc bồn chồn đến mức bạn đã di chuyển nhiều hơn bình thường không?)",
    "Thoughts that you would be better off dead, or thoughts of hurting yourself in some way?\n(Bạn có suy nghĩ rằng bạn sẽ tốt hơn nếu chết, hoặc suy nghĩ về việc gây hại cho bản thân theo một cách nào đó không?)"
]

# =====================================================================
# 3. GAD-7 QUESTIONS (Anxiety Screening - 7 questions)
# =====================================================================
GAD7_QUESTIONS = [
    "Feeling nervous, anxious, or on edge?\n(Bạn có cảm thấy lo lắng, bồn chồn hoặc căng thẳng không?)",
    "Not being able to stop or control worrying?\n(Bạn có không thể ngừng hoặc kiểm soát việc lo lắng không?)",
    "Worrying too much about different things?\n(Bạn có lo lắng quá nhiều về những điều khác nhau không?)",
    "Trouble relaxing?\n(Bạn có gặp khó khăn khi thư giãn không?)",
    "Being so restless that it is hard to sit still?\n(Bạn có quá bất an đến mức khó ngồi yên không?)",
    "Becoming easily annoyed or irritable?\n(Bạn có dễ bị làm phiền hoặc bực bội không?)",
    "Feeling afraid as if something awful might happen?\n(Bạn có cảm thấy sợ hãi như thể điều gì đó tệ hại có thể xảy ra không?)"
]

# =====================================================================
# 4. CONVERSATION QUESTIONS (Pool of questions for chatbot)
# These will be asked during 2-3 turn conversation
# =====================================================================

CONVERSATION_QUESTIONS = {
    # Questions for Depression (from baseline)
    "Depression": {
        "normal": [
            "That's great to hear! What activities bring you the most joy lately?",
            "How are your sleep and energy levels these days?",
            "Tell me about your typical day - what keeps you occupied?",
            "Do you have people you can talk to when feeling down?",
            "What's one thing that made you smile recently?",
        ],
        "mild": [
            "You mentioned feeling a bit low. When did this feeling start?",
            "How does this depression affect your daily activities like work or hobbies?",
            "Have you noticed changes in your sleep or appetite?",
            "What usually helps you feel a bit better?",
            "Do you find it hard to concentrate or make decisions?",
            "How's your energy level - do you feel tired a lot?",
            "Have you lost interest in things you usually enjoy?",
        ],
        "moderate": [
            "I can sense you're going through a tough time. How long have you felt this way?",
            "How is this affecting your ability to work or study?",
            "Have your sleep patterns changed significantly?",
            "Do you have support from family or friends right now?",
            "Have you thought about talking to a therapist or counselor?",
            "What was the trigger or when did this start?",
            "How are you coping with these feelings day-to-day?",
            "Have you experienced loss of appetite or significant weight change?",
        ],
        "severe": [
            "I'm concerned about what you're sharing. Do you have thoughts of harming yourself?",
            "Is there someone close to you - family, friend, doctor - you can reach out to?",
            "Have you considered professional help or therapy?",
            "How long have you been experiencing these severe feelings?",
            "Is there anything - even small - that brings you some comfort?",
            "Do you have a crisis hotline number you can call if things get worse?",
            "Have you tried any coping strategies that help, even temporarily?",
        ]
    },
    
    # Questions for Anxiety (from baseline)
    "Anxiety": {
        "normal": [
            "That's wonderful that you're managing well! What's your secret?",
            "How do you typically handle stressful situations?",
            "What activities help you stay calm and grounded?",
            "Tell me about a time you felt completely relaxed recently.",
            "How are your relationships and social life?",
        ],
        "mild": [
            "You mentioned some anxiety. When does it typically show up?",
            "What situations tend to trigger your anxious feelings?",
            "How do you usually cope when anxiety kicks in?",
            "Have you tried any relaxation techniques like breathing exercises?",
            "Does the anxiety affect your sleep or concentration?",
            "How often would you say you feel worried?",
            "What's usually on your mind when you're feeling anxious?",
        ],
        "moderate": [
            "I hear that anxiety is affecting your daily life. What's been the hardest part?",
            "Can you describe a typical anxiety episode for me?",
            "How long does it usually last and how often does it happen?",
            "What physical symptoms do you experience (racing heart, sweating, etc)?",
            "Have you tried any strategies to manage these feelings?",
            "Is there a specific time of day when anxiety is worse?",
            "How's this impacting your work, relationships, or activities?",
            "Have you considered speaking with a mental health professional?",
        ],
        "severe": [
            "I'm hearing that anxiety is really overwhelming you. How are you holding up?",
            "Do you have panic attacks? Can you describe what they're like?",
            "Is the anxiety preventing you from doing everyday activities?",
            "Do you have support - family, friends, or professional help?",
            "Have you been to a doctor or therapist about this?",
            "What helps even slightly - is there anything that provides relief?",
            "Are there days when it feels completely unmanageable?",
        ]
    },
    
    # Mixed questions (generic, usable for any condition)
    "generic": [
        "Tell me a bit more about what's been on your mind lately.",
        "How have you been coping with everything?",
        "Is there anything positive happening in your life right now?",
        "Have you talked to anyone about how you're feeling?",
        "What would help you feel better right now?",
        "How's your support system - do you have people you can talk to?",
        "What's one thing you'd like to improve or change?",
        "When was the last time you felt genuinely happy or at peace?",
    ]
}

# =====================================================================
# 5. HIGH-RISK QUESTIONS (For Severe cases)
# =====================================================================
HIGH_RISK_QUESTIONS = [
    "Have you had thoughts of harming yourself or ending your life?",
    "Do you have a plan? Have you thought about how you would do it?",
    "Do you have access to means (medications, weapons, etc)?",
    "Do you have someone you can reach out to immediately if things get worse?",
    "Are you currently under the care of a mental health professional?",
]

# =====================================================================
# 6. SUPPORTING INFORMATION
# =====================================================================
CRISIS_RESOURCES = {
    "hotline": "National Suicide Prevention Lifeline: 988 (US) | Crisis Text Line: Text HOME to 741741",
    "website": "https://www.iasp.info/resources/Crisis_Centres/",
    "international": {
        "United States": "988 (Suicide & Crisis Lifeline)",
        "United Kingdom": "116 123 (Samaritans)",
        "Canada": "1-833-456-4566 (Canada Suicide Prevention Service)",
        "Australia": "13 11 14 (Lifeline)",
        "India": "+91-899-900-0019 (iCall)",
        "Vietnam": "1800 1080 (Tổng đài tư vấn Sức khỏe Tâm thần)"
    }
}

# Mapping of 7 mental health labels (from BERT model)
# MUST match the training dataset labels exactly
# From Kaggle training log: {'anxiety': 0, 'bipolar': 1, 'depression': 2, 'normal': 3, 'personality disorder': 4, 'stress': 5, 'suicidal': 6}
MENTAL_HEALTH_LABELS = {
    0: "Anxiety",
    1: "Bipolar",
    2: "Depression",
    3: "Normal",
    4: "Personality Disorder",
    5: "Stress",
    6: "Suicidal"
}

# Reverse mapping for reference
LABEL_TO_ID = {v: k for k, v in MENTAL_HEALTH_LABELS.items()}
