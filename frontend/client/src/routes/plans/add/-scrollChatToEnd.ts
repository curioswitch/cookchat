export type ChatEndTarget = {
  scrollIntoView: (options: ScrollIntoViewOptions) => void;
};

export function scrollChatToEnd(target: ChatEndTarget | null) {
  target?.scrollIntoView({ block: "end", behavior: "smooth" });
}
