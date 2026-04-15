import { create } from "@bufbuild/protobuf";
import { useMutation } from "@connectrpc/connect-query";
import {
  type ChatMessage,
  ChatMessage_Role,
  ChatMessageSchema,
  chatPlan,
  type GetChatMessagesResponse,
  GetChatMessagesResponseSchema,
} from "@cookchat/frontend-api";
import { Button, Input, TextField } from "@heroui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { FiExternalLink, FiSend } from "react-icons/fi";
import { twMerge } from "tailwind-merge";

import { useFrontendQueries } from "../../../hooks/rpc";
import { m } from "../../../paraglide/messages";

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
              ? "right text-right bg-yellow-400 text-white"
              : "left bg-white",
          )}
        >
          <div>
            {message.content || <ChatBubbleLoading />}
            {message.urls && (
              <>
                <br />
                {message.urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    {m.chat_original_recipe_title()}
                    <FiExternalLink aria-hidden className="size-4" />
                  </a>
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
  const navigate = useNavigate();
  const queries = useFrontendQueries();
  const getChatMessagesQuery = queries.getChatMessages();
  const queryClient = useQueryClient();

  const { data: getChatMessagesRes, isPending } = useQuery({
    ...getChatMessagesQuery,
    refetchInterval: (query) => {
      const messages = query.state.data?.messages ?? [];
      const last = messages[messages.length - 1];

      return last?.role === ChatMessage_Role.ASSISTANT && !last?.content
        ? 3000
        : false;
    },
    refetchIntervalInBackground: true,
  });

  const [loaded, setLoaded] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");

  const doChatPlan = useMutation(chatPlan, {
    onMutate: (req) => {
      queryClient.setQueryData<GetChatMessagesResponse>(
        getChatMessagesQuery.queryKey,
        (prev) =>
          create(GetChatMessagesResponseSchema, {
            chatId: req.newChat ? "" : (prev?.chatId ?? ""),
            planId: "",
            messages: [
              ...(req.newChat ? [] : (prev?.messages ?? [])),
              create(ChatMessageSchema, {
                role: ChatMessage_Role.USER,
                content: req.message,
              }),
              create(ChatMessageSchema, {
                role: ChatMessage_Role.ASSISTANT,
              }),
            ],
          }),
      );
    },
    onSuccess: (resp) => {
      if (resp.planId) {
        void navigate({
          to: "/plans/$id",
          params: { id: resp.planId },
        });
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

  const startNewChat = useCallback(() => {
    doChatPlan.mutate({
      newChat: true,
      message: m.chat_greeting(),
    });
  }, [doChatPlan]);

  useEffect(() => {
    if (loaded || !getChatMessagesRes) {
      return;
    }
    setLoaded(true);

    if (getChatMessagesRes.messages.length === 0) {
      startNewChat();
    }
  }, [startNewChat, getChatMessagesRes, loaded]);

  const onNewChatClick = useCallback(() => {
    startNewChat();
  }, [startNewChat]);

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
    return <div>{m.common_loading()}</div>;
  }

  if (!getChatMessagesRes) {
    throw new Error("Chat messages not loaded");
  }

  const messages = getChatMessagesRes.messages;
  const assistantPending =
    messages[messages.length - 1]?.role === ChatMessage_Role.ASSISTANT &&
    !messages[messages.length - 1]?.content;

  return (
    <div>
      {messages.map((msg, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ordered list of items
        <ChatBubble key={i} message={msg} />
      ))}
      <div className="p-4 flex gap-4">
        <Button
          className="bg-yellow-400"
          onPress={onNewChatClick}
          isDisabled={doChatPlan.isPending || assistantPending}
        >
          {m.add_plan_new_chat()}
        </Button>
        {getChatMessagesRes.planId && (
          <Link
            to="/plans/$id"
            params={{ id: getChatMessagesRes.planId }}
            className="decoration-0"
          >
            <Button className="bg-yellow-400">{m.add_plan_view_plan()}</Button>
          </Link>
        )}
      </div>
      <div className="flex w-full min-w-0 gap-4 rounded-2xl border border-gray-200 bg-white p-6">
        <TextField
          value={inputText}
          onChange={setInputText}
          className="min-w-0 flex-1"
        >
          <Input fullWidth placeholder={m.chat_input_placeholder()} />
        </TextField>
        <Button
          isIconOnly
          className="shrink-0 bg-yellow-400 text-white hover:bg-yellow-500"
          onPress={onSendClick}
          isDisabled={
            doChatPlan.isPending || assistantPending || inputText.trim() === ""
          }
        >
          <FiSend />
        </Button>
      </div>
    </div>
  );
}
