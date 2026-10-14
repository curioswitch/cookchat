import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import {
  type LiveSessionOptions,
  OpenAILiveSession,
} from "./OpenAILiveSession";

type SentEvent = {
  type: string;
  item?: {
    type?: string;
    role?: string;
    content?: { type: string; text: string }[];
    call_id?: string;
    output?: string;
  };
};
class FakeChannel {
  readyState = "connecting";
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose: (() => void) | null = null;
  sent: SentEvent[] = [];
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = "closed";
    this.onclose?.();
  }
  emit(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}
class FakePeer extends EventTarget {
  static latest: FakePeer;
  static gatherIce = false;
  static autoStart = true;
  channel = new FakeChannel();
  connectionState = "new";
  iceGatheringState = FakePeer.gatherIce ? "gathering" : "complete";
  localDescription?: { sdp: string };
  remoteDescription?: { type: string; sdp: string };
  onconnectionstatechange: (() => void) | null = null;
  ontrack?: (event: { track: unknown; streams: unknown[] }) => void;
  trackCount = 0;
  constructor() {
    super();
    FakePeer.latest = this;
  }
  createDataChannel(label: string) {
    assert.equal(label, "oai-events");
    return this.channel;
  }
  addTrack() {
    this.trackCount++;
  }
  async createOffer() {
    return { sdp: "offer" };
  }
  async setLocalDescription(offer: { sdp: string }) {
    this.localDescription = offer;
  }
  async setRemoteDescription(answer: { type: string; sdp: string }) {
    this.remoteDescription = answer;
    this.channel.readyState = "open";
    if (FakePeer.autoStart) this.channel.emit({ type: "session.started" });
  }
  close() {
    this.connectionState = "closed";
    this.onconnectionstatechange?.();
  }
}
class FakeAudio {
  static latest: FakeAudio;
  autoplay = false;
  srcObject: unknown;
  sinkId?: string;
  paused = false;
  constructor() {
    FakeAudio.latest = this;
  }
  async setSinkId(id: string) {
    this.sinkId = id;
  }
  async play() {}
  pause() {
    this.paused = true;
  }
}
const globals = ["RTCPeerConnection", "Audio", "navigator"] as const;
const saved = globals.map((name) =>
  Object.getOwnPropertyDescriptor(globalThis, name),
);
let trackStops: number;
let microphoneConstraints: MediaStreamConstraints | undefined;
let media: MediaStream;
let sessions: OpenAILiveSession[];
let steps: number[];
let ingredientCalls: number;
let errors: Error[];
let closed: number;
function makeSession(overrides: Partial<LiveSessionOptions> = {}) {
  const session = new OpenAILiveSession({
    createSession: async (offer) => {
      assert.equal(offer, "offer");
      return { sdpAnswer: "answer", startMessage: "" };
    },
    navigateToStep: (step) => steps.push(step),
    navigateToIngredients: () => {
      ingredientCalls++;
    },
    onError: (error) => errors.push(error),
    onClosed: () => {
      closed++;
    },
    ...overrides,
  });
  sessions.push(session);
  return session;
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function responseEvent(
  type: string,
  extras: Record<string, unknown> = {},
  delegation_id: string | null = "delegation",
) {
  FakePeer.latest.channel.emit({
    type: "response.event",
    delegation_id,
    event: { type, ...extras },
  });
}
function call(id: string, name: string, args: string) {
  responseEvent("response.output_item.done", {
    item: { type: "function_call", call_id: id, name, arguments: args },
  });
}
beforeEach(() => {
  FakePeer.gatherIce = false;
  FakePeer.autoStart = true;
  trackStops = 0;
  microphoneConstraints = undefined;
  media = {
    getTracks: () => [
      {
        stop: () => {
          trackStops++;
        },
      },
    ],
  } as unknown as MediaStream;
  sessions = [];
  steps = [];
  ingredientCalls = 0;
  errors = [];
  closed = 0;
  Object.defineProperty(globalThis, "RTCPeerConnection", {
    configurable: true,
    value: FakePeer,
  });
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: FakeAudio,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          microphoneConstraints = constraints;
          return media;
        },
      },
    },
  });
});
afterEach(() => {
  for (const session of sessions) session.stop();
  FakePeer.latest?.channel.emit({ type: "session.closed" });
  globals.forEach((name, i) => {
    const descriptor = saved[i];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  });
});
describe("OpenAILiveSession", () => {
  test("waits for session.started and respects microphone and speaker selection", async () => {
    FakePeer.autoStart = false;
    const session = makeSession({
      microphoneDeviceId: "mic",
      speakerDeviceId: "speaker",
    });
    let ready = false;
    const starting = session.start().then(() => {
      ready = true;
    });
    await tick();
    assert.equal(ready, false);
    assert.deepEqual(FakePeer.latest.remoteDescription, {
      type: "answer",
      sdp: "answer",
    });
    assert.deepEqual(microphoneConstraints, {
      audio: { deviceId: { exact: "mic" } },
    });
    assert.equal(FakeAudio.latest.sinkId, "speaker");
    assert.equal(FakePeer.latest.trackCount, 1);
    assert.equal(FakePeer.latest.channel.sent.length, 0);
    FakePeer.latest.channel.emit({ type: "session.started" });
    await starting;
    assert.equal(ready, true);
  });
  test("requests the localized opening response once, only after session.started", async () => {
    for (const startMessage of ["Hello!", "こんにちは！"]) {
      FakePeer.autoStart = false;
      const session = makeSession({
        createSession: async () => ({ sdpAnswer: "answer", startMessage }),
      });
      const starting = session.start();
      await tick();
      const channel = FakePeer.latest.channel;
      assert.equal(channel.sent.length, 0);
      channel.emit({ type: "session.started" });
      await starting;
      assert.deepEqual(
        channel.sent.map((event) => event.type),
        ["response.item.create", "response.create"],
      );
      assert.deepEqual(channel.sent[0].item, {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: startMessage }],
      });
      channel.emit({ type: "session.started" });
      assert.equal(channel.sent.length, 2);
      session.stop();
      channel.emit({ type: "session.closed" });
    }
  });
  test("sends the SDP only after ICE gathering completes", async () => {
    FakePeer.gatherIce = true;
    let offers = 0;
    const session = makeSession({
      createSession: async (offer) => {
        offers++;
        assert.equal(offer, "offer-with-candidates");
        return { sdpAnswer: "answer", startMessage: "" };
      },
    });
    const starting = session.start();
    await tick();
    assert.equal(offers, 0);
    FakePeer.latest.localDescription = { sdp: "offer-with-candidates" };
    FakePeer.latest.iceGatheringState = "complete";
    FakePeer.latest.dispatchEvent(new Event("icegatheringstatechange"));
    await starting;
    assert.equal(offers, 1);
  });
  test("runs each tool once and returns all results before continuing the backend", async () => {
    await makeSession().start();
    responseEvent("response.created", { response: { id: "response-1" } });
    call("call-1", "navigate_to_step", '{"step":5}');
    call("call-1", "navigate_to_step", '{"step":5}');
    call("call-2", "navigate_to_ingredients", "{}");
    assert.deepEqual(steps, [4]);
    assert.equal(ingredientCalls, 1);
    assert.deepEqual(
      FakePeer.latest.channel.sent.map((event) => event.type),
      ["response.item.create", "response.item.create"],
    );
    responseEvent("response.completed", {
      response: { id: "response-1", output: [] },
    });
    responseEvent("response.completed", {
      response: { id: "response-1", output: [] },
    });
    assert.deepEqual(
      FakePeer.latest.channel.sent.map((event) => event.type),
      ["response.item.create", "response.item.create", "response.create"],
    );
    assert.equal(FakePeer.latest.channel.sent[0].item?.call_id, "call-1");
    assert.match(FakePeer.latest.channel.sent[0].item?.output ?? "", /step 5/);
    responseEvent("response.created", { response: { id: "response-2" } });
    call("call-3", "navigate_to_step", '{"step":6}');
    responseEvent("response.completed", { response: { id: "response-2" } });
    assert.deepEqual(steps, [4, 5]);
    assert.equal(
      FakePeer.latest.channel.sent.filter(
        (event) => event.type === "response.create",
      ).length,
      2,
    );
  });
  test("returns tool errors without changing navigation", async () => {
    await makeSession().start();
    responseEvent("response.created", { response: { id: "response" } });
    call("zero", "navigate_to_step", '{"step":0}');
    call("fraction", "navigate_to_step", '{"step":1.5}');
    call("bad-json", "navigate_to_step", "{");
    call("unknown", "other_tool", "{}");
    assert.deepEqual(steps, []);
    assert.equal(errors.length, 0);
    for (const event of FakePeer.latest.channel.sent)
      assert.ok(JSON.parse(event.item?.output ?? "{}").error);
    responseEvent("response.completed", { response: { id: "response" } });
    assert.equal(FakePeer.latest.channel.sent.at(-1)?.type, "response.create");
  });
  test("supports envelopes without a delegation ID and ignores unknown events", async () => {
    await makeSession().start();
    responseEvent("response.created", { response: { id: "response" } }, null);
    responseEvent(
      "response.output_item.done",
      {
        item: {
          type: "function_call",
          call_id: "call",
          name: "navigate_to_step",
          arguments: '{"step":2}',
        },
      },
      null,
    );
    responseEvent("response.completed", { response: { id: "response" } }, null);
    FakePeer.latest.channel.emit({ type: "future.event" });
    responseEvent("response.future.event");
    assert.deepEqual(steps, [1]);
    assert.equal(errors.length, 0);
    assert.equal(FakePeer.latest.channel.sent.at(-1)?.type, "response.create");
  });
  test("stopping releases audio immediately and finalizes before closing the peer", async () => {
    const session = makeSession();
    await session.start();
    session.stop();
    session.stop();
    assert.equal(trackStops, 1);
    assert.equal(FakeAudio.latest.paused, true);
    assert.equal(FakeAudio.latest.srcObject, null);
    assert.deepEqual(
      FakePeer.latest.channel.sent.map((event) => event.type),
      ["session.close"],
    );
    assert.notEqual(FakePeer.latest.connectionState, "closed");
    FakePeer.latest.channel.emit({ type: "session.closed" });
    assert.equal(FakePeer.latest.connectionState, "closed");
    assert.equal(closed, 0);
    call("late", "navigate_to_step", '{"step":3}');
    assert.deepEqual(steps, []);
  });
  test("cancels during ICE gathering without creating a billable session", async () => {
    FakePeer.gatherIce = true;
    let offers = 0;
    const session = makeSession({
      createSession: async () => {
        offers++;
        return { sdpAnswer: "answer", startMessage: "" };
      },
    });
    const starting = session.start();
    await tick();
    session.stop();
    await assert.rejects(starting);
    assert.equal(offers, 0);
    assert.equal(trackStops, 1);
    assert.equal(FakePeer.latest.connectionState, "closed");
  });
  test("stops tracks returned after the user cancels microphone permission", async () => {
    let resolveMedia!: (stream: MediaStream) => void;
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        resolveMedia = resolve;
      });
    const session = makeSession();
    const starting = session.start();
    session.stop();
    resolveMedia(media);
    await assert.rejects(starting);
    assert.equal(trackStops, 1);
    assert.equal(FakePeer.latest.connectionState, "closed");
  });
  test("failed session creation releases the microphone and peer", async () => {
    const session = makeSession({
      createSession: async () => {
        throw new Error("server failed");
      },
    });
    await assert.rejects(session.start(), /server failed/);
    assert.equal(trackStops, 1);
    assert.equal(FakePeer.latest.connectionState, "closed");
  });
  test("backend failure reports an error and stops audio", async () => {
    await makeSession().start();
    responseEvent("response.failed", {
      response: { id: "response", error: { message: "backend unavailable" } },
    });
    assert.equal(errors[0]?.message, "backend unavailable");
    assert.equal(trackStops, 1);
    assert.equal(FakePeer.latest.channel.sent.at(-1)?.type, "session.close");
  });
  test("a server-initiated close releases media and notifies the UI", async () => {
    await makeSession().start();
    FakePeer.latest.channel.emit({ type: "session.closed", reason: "expired" });
    assert.equal(trackStops, 1);
    assert.equal(FakePeer.latest.connectionState, "closed");
    assert.equal(closed, 1);
  });
});
