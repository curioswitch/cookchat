import { create } from "@bufbuild/protobuf";
import { useMutation } from "@connectrpc/connect-query";
import {
  type ChatMessage,
  ChatMessage_Role,
  ChatMessageSchema,
  chatPlan,
} from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiSend } from "react-icons/fi";
import { twMerge } from "tailwind-merge";

function ChatBubbleLoading() {
  return (
    <div className="h-12 flex space-x-1 items-center justify-center">
      <div className="h-2 w-2 bg-black rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="h-2 w-2 bg-black rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="h-2 w-2 bg-black rounded-full animate-bounce" />
    </div>
  );
}

const ChatBubble = forwardRef<HTMLDivElement, { message: ChatMessage }>(
  function ChatBubble({ message }, ref) {
    const { t } = useTranslation();
    const isUser = message.role === ChatMessage_Role.USER;

    return (
      <div
        className={twMerge(
          "flex items-center gap-5 px-5 py-2 md:py-4",
          isUser && "flex-row-reverse",
        )}
        ref={ref}
      >
        <div
          className={twMerge(
            "max-w-2xl rounded-3xl py-3 px-4 md:px-7 h-fit whitespace-pre-line speech-bubble mt-4 leading-7 md:text-xl md:font-medium md:leading-8 flex items-center",
            isUser ? "right text-right bg-primary text-white" : "left bg-white",
          )}
        >
          <div>
            {message.content || <ChatBubbleLoading />}
            {message.urls && (
              <>
                <br />
                {message.urls.map((url) => (
                  <Link href={url} key={url} isExternal showAnchorIcon>
                    {t("Original Recipe")}
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    );
  },
);

export function ChatPlan() {
  const { t } = useTranslation();

  const [loaded, setLoaded] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    create(ChatMessageSchema, {
      role: ChatMessage_Role.USER,
      content: t("Hello"),
    }),
  ]);

  const doChatPlan = useMutation(chatPlan, {
    onSuccess: (resp) => {
      setMessages(resp.messages);
    },
  });

  useEffect(() => {
    if (loaded) {
      return;
    }
    setLoaded(true);
    const m = [...messages];
    // For double-render in React dev mode. We will eventually have
    // server side state for the chat and this will stop being a problem.
    if (!m[m.length - 1].content) {
      return;
    }
    doChatPlan.mutate({
      messages: m,
    });
    messages.push(
      create(ChatMessageSchema, {
        role: ChatMessage_Role.ASSISTANT,
      }),
    );
  }, [doChatPlan, messages, loaded]);

  const onSendClick = useCallback(() => {
    messages.push(
      create(ChatMessageSchema, {
        role: ChatMessage_Role.USER,
        content: inputText,
      }),
    );
    setInputText("");
    const m = [...messages];
    doChatPlan.mutate({
      messages: m,
    });
    messages.push(
      create(ChatMessageSchema, {
        role: ChatMessage_Role.ASSISTANT,
      }),
    );
  }, [messages, inputText, doChatPlan]);

  useEffect(() => {
    const _ = messages;
    window.scrollTo(0, document.body.scrollHeight);
  }, [messages]);

  return (
    <div>
      {messages.map((msg, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        <ChatBubble key={i} message={msg} />
      ))}
      <div className="p-6 bg-white border-1 border-gray-200 rounded-2xl flex gap-4">
        <Input
          placeholder={t("Enter message...")}
          value={inputText}
          onValueChange={setInputText}
        />
        <Button color="primary" className="text-white" onPress={onSendClick}>
          <FiSend />
        </Button>
      </div>
    </div>
  );
}
