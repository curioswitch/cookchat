import { create } from "@bufbuild/protobuf";
import { useMutation } from "@connectrpc/connect-query";
import {
  type ChatMessage,
  ChatMessage_Role,
  ChatMessageSchema,
  chatPlan,
  GetChatMessagesResponseSchema,
} from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiSend } from "react-icons/fi";
import { twMerge } from "tailwind-merge";
import { navigate } from "vike/client/router";

import { useFrontendQueries } from "../../../hooks/rpc";

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
            isUser
              ? "right text-right bg-primary-400 text-white"
              : "left bg-white",
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

const loadingMessage = create(ChatMessageSchema, {
  role: ChatMessage_Role.ASSISTANT,
});

export function ChatPlan() {
  const { t } = useTranslation();

  const queries = useFrontendQueries();
  const getChatMessagesQuery = queries.getChatMessages();
  const queryClient = useQueryClient();

  const { data: getChatMessagesRes, isPending } =
    useQuery(getChatMessagesQuery);

  const [loaded, setLoaded] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");

  const doChatPlan = useMutation(chatPlan, {
    onMutate: (req) => {
      const messages = getChatMessagesRes?.messages ?? [];
      messages.push(
        create(ChatMessageSchema, {
          role: ChatMessage_Role.USER,
          content: req.message,
        }),
      );
    },
    onSuccess: (resp) => {
      if (resp.planId) {
        navigate(`/plans/${resp.planId}`);
      } else {
        queryClient.setQueryData(
          getChatMessagesQuery.queryKey,
          create(GetChatMessagesResponseSchema, {
            chatId: resp.chatId,
            messages: resp.messages,
          }),
        );
      }
    },
  });

  useEffect(() => {
    if (loaded || !getChatMessagesRes) {
      return;
    }
    setLoaded(true);

    if (getChatMessagesRes.messages.length === 0) {
      doChatPlan.mutate({
        chatId: getChatMessagesRes?.chatId,
        message: t("Hello"),
      });
    }
  }, [doChatPlan, getChatMessagesRes, loaded, t]);

  const onSendClick = useCallback(() => {
    const message = inputText;
    setInputText("");
    doChatPlan.mutate({
      chatId: getChatMessagesRes?.chatId,
      message: message,
    });
  }, [getChatMessagesRes, inputText, doChatPlan]);

  useEffect(() => {
    const _ = getChatMessagesRes;
    const __ = doChatPlan.isPending;
    window.scrollTo(0, document.body.scrollHeight);
  }, [getChatMessagesRes, doChatPlan.isPending]);

  if (isPending) {
    return <div>{t("Loading...")}</div>;
  }

  if (!getChatMessagesRes) {
    throw new Error("Chat messages not loaded");
  }

  const messages = getChatMessagesRes.messages;

  return (
    <div>
      {messages.map((msg, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ordered list of items
        <ChatBubble key={i} message={msg} />
      ))}
      {doChatPlan.isPending && <ChatBubble message={loadingMessage} />}
      <div className="p-6 bg-white border-1 border-gray-200 rounded-2xl flex gap-4">
        <Input
          placeholder={t("Enter message...")}
          value={inputText}
          onValueChange={setInputText}
        />
        <Button
          className="bg-primary-400 text-white hover:bg-primary-500"
          onPress={onSendClick}
          disabled={doChatPlan.isPending}
        >
          <FiSend />
        </Button>
      </div>
    </div>
  );
}
