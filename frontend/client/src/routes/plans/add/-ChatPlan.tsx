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
import { getApp } from "firebase/app";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import {
  type ChangeEvent,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FiCamera, FiExternalLink, FiSend, FiX } from "react-icons/fi";
import { twMerge } from "tailwind-merge";

import { useFirebaseUser } from "../../../hooks/firebase";
import { getFirebaseConfig } from "../../../hooks/firebase/config";
import { useFrontendQueries } from "../../../hooks/rpc";
import { m } from "../../../paraglide/messages";

import { ChatComposerShell } from "./-ChatComposerShell";
import { ChatMessageContent } from "./-ChatMessageContent";
import { ChatQuickActions } from "./-ChatQuickActions";
import { getQuickReplies } from "./-quickReplies";
import { scrollChatToEnd } from "./-scrollChatToEnd";

const maxImageBytes = 5 * 1024 * 1024;
const maxImageDimension = 2048;

function canvasToJPEG(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to encode image"));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

async function resizeImage(file: File) {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const initialScale = Math.min(
      1,
      maxImageDimension / Math.max(bitmap.width, bitmap.height),
    );
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let quality = 0.85;

    for (let attempt = 0; attempt < 10; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to create image context");
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasToJPEG(canvas, quality);
      if (blob.size <= maxImageBytes) {
        const basename = file.name.replace(/\.[^.]*$/, "") || "photo";
        return new File([blob], `${basename}.jpg`, {
          type: blob.type,
          lastModified: file.lastModified,
        });
      }

      if (quality > 0.55) {
        quality -= 0.1;
      } else {
        width = Math.max(1, Math.round(width * 0.8));
        height = Math.max(1, Math.round(height * 0.8));
        quality = 0.85;
      }
    }
    throw new Error("Failed to resize image below size limit");
  } finally {
    bitmap.close();
  }
}

function ChatBubbleLoading() {
  return (
    <div className="h-12 flex space-x-1 items-center justify-center">
      <div className="h-2 w-2 bg-black rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="h-2 w-2 bg-black rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="h-2 w-2 bg-black rounded-full animate-bounce" />
    </div>
  );
}

function ChatImage({ imageURL }: { imageURL: string }) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    void (async () => {
      try {
        const parsed = new URL(imageURL);
        const storage = getStorage(getApp(), `gs://${parsed.host}`);
        const downloadURL = await getDownloadURL(storageRef(storage, imageURL));
        setSrc(downloadURL);
      } catch {
        // The message remains usable if its attachment can no longer be loaded.
      }
    })();
  }, [imageURL]);

  if (!src) {
    return null;
  }

  return (
    <img
      src={src}
      alt=""
      className="max-h-72 max-w-full rounded-2xl object-contain"
    />
  );
}

const ChatBubble = forwardRef<HTMLDivElement, { message: ChatMessage }>(
  function ChatBubble({ message }, ref) {
    const isUser = message.role === ChatMessage_Role.USER;
    const showBubble =
      message.content !== "" || message.urls.length > 0 || !isUser;

    return (
      <div
        className={twMerge(
          "flex w-full min-w-0 items-center gap-5 px-0 py-2 md:px-5 md:py-4",
          isUser && "flex-row-reverse",
        )}
        ref={ref}
      >
        <div
          className={twMerge(
            "flex w-full min-w-0 max-w-2xl flex-col gap-2",
            isUser ? "items-end" : "items-start",
          )}
        >
          {message.imageUrls.map((imageURL) => (
            <ChatImage key={imageURL} imageURL={imageURL} />
          ))}
          {showBubble && (
            <div
              className={twMerge(
                "max-w-full min-w-0 rounded-3xl py-3 px-4 md:px-7 h-fit speech-bubble mt-2 leading-7 md:text-xl md:font-medium md:leading-8 flex items-center",
                isUser
                  ? "right text-right bg-yellow-400 text-white"
                  : "left bg-white",
              )}
            >
              <div className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
                {message.content ? (
                  <ChatMessageContent
                    content={message.content}
                    isUser={isUser}
                  />
                ) : (
                  <ChatBubbleLoading />
                )}
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
          )}
        </div>
      </div>
    );
  },
);

export function ChatPlan() {
  const navigate = useNavigate();
  const firebaseUser = useFirebaseUser();
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
  const [selectedImage, setSelectedImage] = useState<
    { file: File; previewURL: string } | undefined
  >();
  const [isResizing, setIsResizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
                imageUrls: req.imageUrls,
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

  const sendMessage = useCallback(
    (message: string, imageUrls: string[] = []) => {
      doChatPlan.mutate({
        chatId: getChatMessagesRes?.chatId,
        message,
        imageUrls,
      });
      setInputText("");
      setSelectedImage(undefined);
    },
    [doChatPlan, getChatMessagesRes?.chatId],
  );

  const onSendClick = useCallback(async () => {
    if (!firebaseUser) {
      return;
    }

    const message = inputText;
    let imageURLs: string[] = [];
    setUploadError(undefined);

    if (selectedImage) {
      setIsUploading(true);
      try {
        const config = getFirebaseConfig();
        const storage = getStorage(getApp(), `gs://${config.projectId}-files`);
        const extension = selectedImage.file.name
          .split(".")
          .pop()
          ?.replace(/[^a-zA-Z0-9]/g, "");
        const objectName = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
        const imageRef = storageRef(
          storage,
          `${firebaseUser.uid}/chatplan/${objectName}`,
        );
        const snapshot = await uploadBytes(imageRef, selectedImage.file, {
          contentType: selectedImage.file.type,
        });
        imageURLs = [snapshot.ref.toString()];
      } catch {
        setUploadError(m.chat_photo_upload_error());
        return;
      } finally {
        setIsUploading(false);
      }
    }

    sendMessage(message, imageURLs);
  }, [firebaseUser, inputText, selectedImage, sendMessage]);

  const onImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }

      setIsResizing(true);
      setUploadError(undefined);
      try {
        const resized = await resizeImage(file);
        setSelectedImage({
          file: resized,
          previewURL: URL.createObjectURL(resized),
        });
      } catch {
        setUploadError(m.chat_photo_processing_error());
      } finally {
        setIsResizing(false);
      }
    },
    [],
  );

  const onRemoveImage = useCallback(() => {
    setSelectedImage(undefined);
    setUploadError(undefined);
  }, []);

  useEffect(
    () => () => {
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage.previewURL);
      }
    },
    [selectedImage],
  );

  useEffect(() => {
    const _ = getChatMessagesRes;
    const __ = doChatPlan.isPending;
    scrollChatToEnd(chatEndRef.current);
  }, [getChatMessagesRes, doChatPlan.isPending]);

  const messages = getChatMessagesRes?.messages ?? [];
  const assistantPending =
    messages[messages.length - 1]?.role === ChatMessage_Role.ASSISTANT &&
    !messages[messages.length - 1]?.content;
  const latestMessage = messages[messages.length - 1];
  const quickReplies =
    latestMessage?.role === ChatMessage_Role.ASSISTANT && latestMessage.content
      ? getQuickReplies(latestMessage.content)
      : [];

  const onQuickReplyClick = useCallback(
    (reply: string) => {
      if (!firebaseUser || doChatPlan.isPending || assistantPending) {
        return;
      }
      sendMessage(reply);
    },
    [firebaseUser, doChatPlan.isPending, assistantPending, sendMessage],
  );

  if (isPending) {
    return <div>{m.common_loading()}</div>;
  }

  if (!getChatMessagesRes) {
    throw new Error("Chat messages not loaded");
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      {messages.map((msg, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ordered list of items
        <ChatBubble key={i} message={msg} />
      ))}
      {getChatMessagesRes.planId && (
        <div className="flex gap-4 p-4">
          <Link
            to="/plans/$id"
            params={{ id: getChatMessagesRes.planId }}
            className="decoration-0"
          >
            <Button className="bg-yellow-400">{m.add_plan_view_plan()}</Button>
          </Link>
        </div>
      )}
      <ChatComposerShell>
        <ChatQuickActions
          quickReplies={quickReplies}
          newChatLabel={m.add_plan_new_chat()}
          isDisabled={doChatPlan.isPending || assistantPending}
          onQuickReply={onQuickReplyClick}
          onNewChat={onNewChatClick}
        />
        {selectedImage && (
          <div className="relative mb-4 w-fit">
            <img
              src={selectedImage.previewURL}
              alt=""
              className="max-h-48 max-w-full rounded-xl object-contain"
            />
            <Button
              isIconOnly
              size="sm"
              aria-label={m.chat_remove_photo()}
              className="absolute -right-2 -top-2 min-w-0 bg-gray-900 text-white"
              onPress={onRemoveImage}
            >
              <FiX />
            </Button>
          </div>
        )}
        <div className="flex w-full min-w-0 gap-2 md:gap-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onImageChange}
          />
          <Button
            isIconOnly
            aria-label={m.chat_add_photo()}
            className="shrink-0 bg-gray-100 text-gray-700"
            onPress={() => imageInputRef.current?.click()}
            isDisabled={
              doChatPlan.isPending ||
              assistantPending ||
              isResizing ||
              isUploading
            }
          >
            <FiCamera />
          </Button>
          <TextField
            value={inputText}
            onChange={setInputText}
            className="min-w-0 flex-1"
          >
            <Input
              fullWidth
              className="w-full"
              placeholder={m.chat_input_placeholder()}
            />
          </TextField>
          <Button
            isIconOnly
            className="shrink-0 bg-yellow-400 text-white hover:bg-yellow-500"
            onPress={onSendClick}
            isDisabled={
              doChatPlan.isPending ||
              assistantPending ||
              isResizing ||
              isUploading ||
              (inputText.trim() === "" && !selectedImage)
            }
          >
            <FiSend />
          </Button>
        </div>
        {uploadError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {uploadError}
          </p>
        )}
      </ChatComposerShell>
      <div ref={chatEndRef} aria-hidden />
    </div>
  );
}
