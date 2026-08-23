type ChatQuickActionsProps = {
  quickReplies: string[];
  newChatLabel: string;
  isDisabled: boolean;
  onQuickReply: (reply: string) => void;
  onNewChat: () => void;
};

export function ChatQuickActions({
  quickReplies,
  newChatLabel,
  isDisabled,
  onQuickReply,
  onNewChat,
}: ChatQuickActionsProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {quickReplies.map((reply) => (
        <button
          key={reply}
          type="button"
          disabled={isDisabled}
          onClick={() => onQuickReply(reply)}
          className="min-w-12 rounded-xl bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-200 disabled:opacity-50"
        >
          {reply}
        </button>
      ))}
      <button
        type="button"
        disabled={isDisabled}
        onClick={onNewChat}
        className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-500 disabled:opacity-50"
      >
        {newChatLabel}
      </button>
    </div>
  );
}
