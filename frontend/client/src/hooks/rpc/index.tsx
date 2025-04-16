import { type Interceptor, createClient } from "@connectrpc/connect";
import { createTransport } from "@connectrpc/connect/protocol-connect";
import { ChatService } from "@cookchat/frontend-api";
import { createWebSocketClient } from "connect-es-ws";
import type { User as FirebaseUser } from "firebase/auth";
import { useMemo } from "react";
import { useFirebase } from "../firebase";

function createFirebaseAuthInterceptor(user: FirebaseUser): Interceptor {
  return (next) => async (request) => {
    const idToken = await user.getIdToken();
    request.header.set("authorization", `Bearer ${idToken}`);
    return next(request);
  };
}

export function useChatServiceStreaming() {
  const fbUser = useFirebase()?.user;

  const transport = useMemo(() => {
    const interceptors = fbUser ? [createFirebaseAuthInterceptor(fbUser)] : [];
    return createTransport({
      httpClient: createWebSocketClient(),
      baseUrl: import.meta.env.PUBLIC_ENV__API_BASE ?? "/",
      useBinaryFormat: true,
      interceptors,
      sendCompression: null,
      acceptCompression: [],
      compressMinBytes: 0,
      readMaxBytes: 0xffffffff,
      writeMaxBytes: 0xffffffff,
    });
  }, [fbUser]);

  return useMemo(() => {
    return createClient(ChatService, transport);
  }, [transport]);
}
