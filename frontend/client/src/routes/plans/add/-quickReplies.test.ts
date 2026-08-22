import { getQuickReplies } from "./-quickReplies";
import { describe, expect, test } from "bun:test";

describe("getQuickReplies", () => {
  test("returns numbered replies from the assistant message", () => {
    const replies = getQuickReplies(
      "次から選んでください。\n1. 和食\n2. 洋食\n3. 中華",
    );

    expect(replies).toEqual(["1", "2", "3"]);
  });

  test("returns confirmation replies for a yes-or-no question", () => {
    const replies = getQuickReplies("この内容で献立を作成してよろしいですか？");

    expect(replies).toEqual(["はい", "いいえ"]);
  });

  test("limits numbered replies to five and removes duplicates", () => {
    const replies = getQuickReplies("1) A\n2) B\n2) B\n3) C\n4) D\n5) E\n6) F");

    expect(replies).toEqual(["1", "2", "3", "4", "5"]);
  });

  test("does not treat a numbered questionnaire as reply choices", () => {
    const replies = getQuickReplies(
      "1. 何日分の献立を作りますか？\n2. 使いたい食材はありますか？",
    );

    expect(replies).toEqual([]);
  });

  test("offers omakase instead of question numbers when the message suggests it", () => {
    const replies = getQuickReplies(
      "続けて、以下の点についても教えていただけますか？\n\n1. **使いたい食材はありますか？**（冷蔵庫にあるものや、写真の添付でも大丈夫です）\n2. **アレルギーや苦手な食材、食事制限、和洋中などのジャンルのご希望はありますか？**\n\n特にない場合は、「おまかせ」とお知らせください！",
    );

    expect(replies).toEqual(["おまかせ"]);
  });
});
