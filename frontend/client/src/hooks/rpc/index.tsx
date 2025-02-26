import { createClient } from "@connectrpc/connect";
import { createTransport } from "@connectrpc/connect/protocol-connect";
import { ChatService } from "@cookchat/frontend-api";
import { createWebSocketClient } from "connect-es-ws";
import { useMemo } from "react";

export function useChatServiceStreaming() {
  return useMemo(() => {
    return createClient(
      ChatService,
      createTransport({
        httpClient: createWebSocketClient(),
        baseUrl: "http://localhost:8080/",
        useBinaryFormat: true,
        interceptors: [],
        sendCompression: null,
        acceptCompression: [],
        compressMinBytes: 0,
        readMaxBytes: 0xffffffff,
        writeMaxBytes: 0xffffffff,
      }),
    );
  }, []);
}
