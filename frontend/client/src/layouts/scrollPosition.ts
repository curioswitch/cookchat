export type ScrollPositionTarget = {
  scrollTo: (options: ScrollToOptions) => void;
};

export function resetScrollPosition(target: ScrollPositionTarget | null) {
  target?.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
