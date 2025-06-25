import { create, type MessageInitShape } from "@bufbuild/protobuf";
import {
  Code,
  ConnectError,
  createClient,
  type Interceptor,
  type Transport,
} from "@connectrpc/connect";
import { createTransport } from "@connectrpc/connect/protocol-connect";
import {
  createInfiniteQueryOptions,
  createQueryOptions,
  TransportProvider,
  useTransport,
} from "@connectrpc/connect-query";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
  ChatService,
  type GetRecipeRequestSchema,
  getRecipe,
  listRecipes,
  PaginationSchema,
  type StartChatRequestSchema,
  startChat,
} from "@cookchat/frontend-api";
import {
  infiniteQueryOptions,
  QueryClient,
  QueryClientProvider,
  queryOptions,
} from "@tanstack/react-query";
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

export function useChatService() {
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

const MAX_RETRIES = 3;

function canRetry(error: Error): boolean {
  switch (ConnectError.from(error).code) {
    case Code.InvalidArgument:
    case Code.NotFound:
    case Code.AlreadyExists:
    case Code.PermissionDenied:
    case Code.Unimplemented:
    case Code.Unauthenticated:
      return false;
    default:
      return true;
  }
}

class FrontendQueries {
  constructor(private readonly transport: Transport) {}

  getRecipe(req: MessageInitShape<typeof GetRecipeRequestSchema>) {
    return queryOptions(
      createQueryOptions(getRecipe, req, { transport: this.transport }),
    );
  }

  listRecipes(query: string) {
    return infiniteQueryOptions(
      createInfiniteQueryOptions(
        listRecipes,
        {
          query,
          pagination: create(PaginationSchema),
        },
        {
          transport: this.transport,
          pageParamKey: "pagination",
          getNextPageParam: (lastPage) => lastPage.pagination,
        },
      ),
    );
  }

  startChat(req: MessageInitShape<typeof StartChatRequestSchema>) {
    return createQueryOptions(startChat, req, { transport: this.transport });
  }
}

export function useFrontendQueries(): FrontendQueries {
  const transport = useTransport();
  return useMemo(() => new FrontendQueries(transport), [transport]);
}

export function FrontendServiceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const fbUser = useFirebase()?.user;

  const transport = useMemo(() => {
    const interceptors = fbUser ? [createFirebaseAuthInterceptor(fbUser)] : [];
    return createConnectTransport({
      baseUrl: "/",
      interceptors,
    });
  }, [fbUser]);

  // Most documentation puts the queryClient at the package level as it's the
  // easiest way to guarantee the cache is preserved regardless of rendering
  // loop mistakes, but we get to 1) avoid RPCs until firebase auth is resolved
  // and 2) easily invalidate the query cache on logout, potentially logging-in
  // as a different user, so we use useMemo here. The documentation says useMemo
  // should only be used as an optimization and it's not guaranteed to always
  // be stable even if the inputs don't change. While in some sense an optimization,
  // it is also important to not send unnecessary backend calls so we do want this
  // to be stable. In the unlikely event that useMemo behavior changes to be less
  // strict in the future, we can write our own stable hook instead.
  const queryClient = useMemo(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          enabled: !!fbUser,
          refetchOnWindowFocus: false,
          retry: (failureCount, error) => {
            if (failureCount > MAX_RETRIES) {
              return false;
            }

            return canRetry(error);
          },
        },
      },
    });
  }, [fbUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}
