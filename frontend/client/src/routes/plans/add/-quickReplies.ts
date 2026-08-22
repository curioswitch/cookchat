const numberedChoicePattern = /(?:^|\n)\s*(\d{1,2})\s*[.)．）]\s*[^\n]+/g;
const confirmationQuestionPattern =
  /(?:よろしい(?:です|でしょう)か|いかが(?:です|でしょう)か|(?:この|こちらの).{0,30}(?:でよいですか|でいいですか|進めますか|作成しますか|決定しますか))/s;
const omakaseSuggestionPattern =
  /[「『"]?おまかせ[」』"]?\s*と(?:お知らせ|入力|回答)/;

export function getQuickReplies(message: string): string[] {
  const numberedReplies = Array.from(message.matchAll(numberedChoicePattern))
    .filter((match) => !/[?？]/.test(match[0]))
    .map((match) => match[1]);
  const uniqueNumberedReplies = [...new Set(numberedReplies)].slice(0, 5);

  if (uniqueNumberedReplies.length > 0) {
    return uniqueNumberedReplies;
  }

  if (omakaseSuggestionPattern.test(message)) {
    return ["おまかせ"];
  }

  if (confirmationQuestionPattern.test(message)) {
    return ["はい", "いいえ"];
  }

  return [];
}
