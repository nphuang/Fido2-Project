const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 分鐘
const challenges = new Map(); // 暫時存儲每個用戶的挑戰碼

export function setChallenge(userId, challenge) {
  challenges.set(userId, { challenge, expiresAt: Date.now() + CHALLENGE_EXPIRY_MS });
}

export function getChallenge(userId) {
  const challengeData = challenges.get(userId);
  if (challengeData && Date.now() < challengeData.expiresAt) {
    return challengeData.challenge;
  }
  challenges.delete(userId); // 過期後刪除
  return null;
}