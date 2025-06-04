import { create } from "@bufbuild/protobuf";
import { ChatRequestSchema } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { PressEvent, Textarea } from "@heroui/react";
import type { OnPressEndEvent } from "framer-motion";
import {
  EventHandler,
  type FormEventHandler,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useChatService } from "../../../hooks/rpc";

function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768)); // Scale and clamp
  }
  return int16Array;
}

async function* chatRequestStream(
  recipeId: string,
  processor: ScriptProcessorNode,
  end: Promise<true>,
) {
  let dataPromise: PromiseWithResolvers<Int16Array> = Promise.withResolvers();
  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    const dataFloat32 = e.inputBuffer.getChannelData(0);
    const dataPCM16 = convertFloat32ToInt16(dataFloat32);
    dataPromise.resolve(dataPCM16);
    dataPromise = Promise.withResolvers();
  };
  yield create(ChatRequestSchema, {
    recipe: {
      case: "recipeId",
      value: recipeId,
    },
  });
  while (true) {
    const result = await Promise.any([dataPromise.promise, end]);
    if (result === true) {
      return;
    }
    yield create(ChatRequestSchema, {
      content: {
        payload: {
          case: "audio",
          value: new Uint8Array(result.buffer),
        },
      },
    });
  }
}

interface StreamContext {
  audioProcessor: ScriptProcessorNode;
  end: PromiseWithResolvers<true>;
}

function mergeUint8Array(arrays: Uint8Array[]) {
  const totalSize = arrays.reduce((acc, e) => acc + e.length, 0);
  const merged = new Uint8Array(totalSize);

  arrays.forEach((array, i, arrays) => {
    const offset = arrays.slice(0, i).reduce((acc, e) => acc + e.length, 0);
    merged.set(array, offset);
  });

  return merged;
}

class AudioPlayer {
  private readonly audio = new Audio();

  private playing = false;
  private queue: Uint8Array[] = [];

  add(chunk: Uint8Array) {
    this.queue.push(chunk);
    this.play();
  }

  play() {
    if (!this.playing && this.queue.length > 0) {
      this.playing = true;
      const audioWav = AudioPlayer.encodeAudio(this.queue, 24_000, 16, 1);
      this.queue = [];
      this.audio.src = URL.createObjectURL(audioWav);
      this.audio.onended = () => {
        this.playing = false;
        this.play();
      };
      this.audio.play();
    }
  }

  private static encodeAudio(
    queue: Uint8Array[],
    sampleRate: number,
    bitDepth: number,
    numChannels: number,
  ) {
    const audioData = mergeUint8Array(queue);

    const dataSize = audioData.length;
    const fileSize = dataSize + 36;
    const blockAlign = (numChannels * bitDepth) / 8;
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    function writeString(offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, fileSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    const mergedData = mergeUint8Array([new Uint8Array(buffer), audioData]);

    return new Blob([mergedData.buffer], { type: "audio/wav" });
  }
}

export default function ChatButton({ recipeId }: { recipeId: string }) {
  const [streamContext, setStreamContext] = useState<StreamContext | undefined>(
    undefined,
  );

  const chatService = useChatService();

  const audioPlayer = useMemo(() => new AudioPlayer(), []);

  const onClick = useCallback(async () => {
    if (streamContext) {
      streamContext.audioProcessor.disconnect();
      streamContext.end.resolve(true);
      setStreamContext(undefined);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const audioProcessor = audioContext.createScriptProcessor(1024, 1, 1);

      const end = Promise.withResolvers<true>();
      const chatStream = chatService.chat(
        chatRequestStream(recipeId, audioProcessor, end.promise),
      );
      setTimeout(async () => {
        for await (const res of chatStream) {
          if (res.content?.payload.case === "audio") {
            audioPlayer.add(res.content.payload.value);
          }
        }
      }, 0);

      source.connect(audioProcessor);
      audioProcessor.connect(audioContext.destination);

      setStreamContext({ audioProcessor, end });
    }
    return false;
  }, [audioPlayer, streamContext, chatService, recipeId]);

  return (
    <Button fullWidth onPress={onClick}>
      お喋り{streamContext ? "終了" : "スタート"}
    </Button>
  );
}
