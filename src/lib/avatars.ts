export const AVATARS = [
  { id: "avatar-calm", label: "Calm Cloud", emoji: "☁️" },
  { id: "avatar-sun", label: "Sunshine", emoji: "🌤️" },
  { id: "avatar-leaf", label: "Peaceful Leaf", emoji: "🍃" },
  { id: "avatar-star", label: "Bright Star", emoji: "⭐" },
  { id: "avatar-wave", label: "Ocean Wave", emoji: "🌊" },
  { id: "avatar-moon", label: "Night Moon", emoji: "🌙" },
  { id: "avatar-flower", label: "Bloom", emoji: "🌸" },
  { id: "avatar-mountain", label: "Mountain", emoji: "⛰️" },
];

export function getAvatarEmoji(avatarId: string | null | undefined): string {
  if (!avatarId) return "🧠";
  return AVATARS.find((a) => a.id === avatarId)?.emoji ?? "🧠";
}
