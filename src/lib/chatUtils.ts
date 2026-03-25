import type { SeverityLevel, PrimaryIssue } from "@/store/useAppStore";

const keywordMap: Record<string, string[]> = {
  Anxiety: ["anxious", "nervous", "worry", "panic", "fear", "scared", "tense"],
  Depression: ["depressed", "sad", "hopeless", "worthless", "empty", "numb", "miserable"],
  Stress: ["stressed", "overwhelmed", "pressure", "burnout", "exhausted", "overloaded"],
  Suicidal: ["suicide", "kill myself", "end my life", "better off dead", "don't want to live", "self-harm"],
  Bipolar: ["mood swings", "manic", "bipolar", "highs and lows"],
  "Personality disorder": ["identity", "unstable relationships", "abandonment"],
  Normal: [],
};

export function classifyText(text: string): string {
  const lower = text.toLowerCase();
  // Safety check first
  if (keywordMap.Suicidal.some((kw) => lower.includes(kw))) return "Suicidal";
  for (const [label, keywords] of Object.entries(keywordMap)) {
    if (label === "Suicidal" || label === "Normal") continue;
    if (keywords.some((kw) => lower.includes(kw))) return label;
  }
  return "Normal";
}

const CRISIS_RESPONSE = `🚨 **I'm concerned about your safety.**

I want you to know that you're not alone, and help is available right now.

**Please reach out immediately:**
- 🇺🇸 **988 Suicide & Crisis Lifeline:** Call or text **988**
- 🌍 **Crisis Text Line:** Text **HOME** to **741741**
- 🇬🇧 **Samaritans:** Call **116 123**

You matter. Your feelings are valid. A trained counselor can help you through this moment.

*I'm an AI assistant and not equipped to provide crisis support. Please contact the resources above — they are available 24/7.*`;

export function getMockChatResponse(
  userMessage: string,
  nlpLabel: string,
  baseline: SeverityLevel,
  primaryIssue: PrimaryIssue
): string {
  // Safety guardrail
  if (nlpLabel === "Suicidal") return CRISIS_RESPONSE;

  const profile = `[${baseline}] - [${primaryIssue !== "None" ? primaryIssue : nlpLabel}]`;
  const lower = userMessage.toLowerCase();

  // Breathing exercise
  if (lower.includes("breathing") || lower.includes("4-7-8")) {
    return `Great choice! Here's the **4-7-8 Breathing Technique:**\n\n1. **Breathe in** through your nose for **4 seconds**\n2. **Hold** your breath for **7 seconds**\n3. **Exhale** slowly through your mouth for **8 seconds**\n\nRepeat 3-4 times. This activates your parasympathetic nervous system and reduces anxiety.\n\n*Profile: ${profile}*`;
  }

  // Mood tracking
  if (lower.includes("mood") || lower.includes("track")) {
    return `Let's check in with your mood! 📊\n\nOn a scale of 1-10, how would you rate:\n- **Overall mood:** (1 = very low, 10 = great)\n- **Energy level:** (1 = exhausted, 10 = energized)\n- **Anxiety level:** (1 = calm, 10 = very anxious)\n\nJust share your numbers and I'll help you notice patterns over time.\n\n*Profile: ${profile}*`;
  }

  // Journaling
  if (lower.includes("journal") || lower.includes("prompt")) {
    const prompts = [
      "What are three things you're grateful for today, no matter how small?",
      "Describe a moment this week when you felt at peace. What made it special?",
      "If your anxiety could speak, what would it say? Write a response to it.",
      "What would you tell your best friend if they were going through what you're experiencing?",
    ];
    const p = prompts[Math.floor(Math.random() * prompts.length)];
    return `Here's your journaling prompt:\n\n> **${p}**\n\nTake 5-10 minutes to write freely. Don't worry about grammar — just let your thoughts flow.\n\n*Profile: ${profile}*`;
  }

  // Sleep
  if (lower.includes("sleep")) {
    return `Here are evidence-based tips for better sleep: 🌙\n\n1. **Consistent schedule** — Same bedtime & wake time daily\n2. **Screen-free zone** — No devices 30 min before bed\n3. **Cool room** — Keep bedroom at 65-68°F (18-20°C)\n4. **4-7-8 breathing** — Helps calm your nervous system\n5. **Limit caffeine** — None after 2 PM\n\nWould you like me to guide you through a bedtime relaxation exercise?\n\n*Profile: ${profile}*`;
  }

  // Anxiety-related
  if (nlpLabel === "Anxiety" || lower.includes("anxious") || lower.includes("relax")) {
    return `I hear you, and it's brave to acknowledge these feelings. 💚\n\nHere's a **grounding technique** that can help right now:\n\n**5-4-3-2-1 Method:**\n- **5** things you can **see**\n- **4** things you can **touch**\n- **3** things you can **hear**\n- **2** things you can **smell**\n- **1** thing you can **taste**\n\nThis brings your focus to the present moment. Would you like to try it together?\n\n*Profile: ${profile}*`;
  }

  // Stress
  if (nlpLabel === "Stress" || lower.includes("stress")) {
    return `Feeling stressed is your body's way of signaling it needs care. Let's work through this together. 🌿\n\n**Quick stress relief plan:**\n1. **Pause** — Take 3 deep breaths right now\n2. **Prioritize** — What's the ONE most important thing?\n3. **Break it down** — Split that task into tiny steps\n4. **Move** — Even 5 minutes of walking helps\n\nWhat's causing the most stress right now? I'd like to help you work through it.\n\n*Profile: ${profile}*`;
  }

  // Depression
  if (nlpLabel === "Depression") {
    return `Thank you for sharing how you're feeling. I want you to know that these feelings are valid, and you don't have to face them alone. 💙\n\n**Small steps that can help:**\n- Set one tiny, achievable goal for today\n- Reach out to one person you trust\n- Step outside for even 5 minutes\n- Practice self-compassion — talk to yourself as you would to a friend\n\nWould you like to explore any of these together?\n\n*Profile: ${profile}*`;
  }

  // Default / Normal
  return `Thank you for sharing! I'm here to support you. 💚\n\nBased on our conversation, here are some things we can explore:\n- **Breathing exercises** for relaxation\n- **Mood tracking** to identify patterns\n- **Journaling prompts** for self-reflection\n- **Sleep hygiene** tips\n\nWhat would be most helpful for you right now?\n\n*Profile: ${profile}*`;
}
