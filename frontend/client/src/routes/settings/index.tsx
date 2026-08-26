import { useMutation } from "@connectrpc/connect-query";
import { editUser } from "@cookchat/frontend-api";
import {
  Checkbox,
  type Key,
  Label,
  ListBox,
  Select,
  TextArea,
} from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useFrontendQueries } from "../../hooks/rpc";
import { m } from "../../paraglide/messages";
import { getLocale, setLocale } from "../../paraglide/runtime";
import {
  setMicrophoneDeviceId,
  setModel,
  setSpeakerDeviceId,
  setUseOpenAI,
  useSettingsStore,
} from "../../stores";

export const Route = createFileRoute("/settings/")({
  component: Page,
});

function Page() {
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);

  const settings = useSettingsStore();
  const locale = getLocale();

  const onLanguageChange = useCallback((lang: Key | null) => {
    if (lang) {
      setLocale(String(lang) as "en" | "ja");
    }
  }, []);

  const onSpeakerChange = useCallback(async (speaker: Key | null) => {
    if (speaker) {
      setSpeakerDeviceId(String(speaker));
    }
  }, []);

  const onMicrophoneChange = useCallback(async (microphone: Key | null) => {
    if (microphone) {
      setMicrophoneDeviceId(String(microphone));
    }
  }, []);

  useEffect(() => {
    async function getDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setSpeakers(devices.filter((device) => device.kind === "audiooutput"));
      setMicrophones(devices.filter((device) => device.kind === "audioinput"));
    }

    getDevices();
  }, []);

  const [planPrompt, setPlanPrompt] = useState("");
  const [debouncedPlanPrompt] = useDebouncedValue(planPrompt, { wait: 500 });
  const planPromptEdited = useRef(false);

  const doUpdatePlanPrompt = useMutation(editUser);

  const queries = useFrontendQueries();
  const getUserQuery = queries.getUser();
  const { data: userRes, isPending } = useQuery(getUserQuery);

  useEffect(() => {
    if (userRes && !planPromptEdited.current) {
      setPlanPrompt(userRes.planPrompt);
    }
  }, [userRes]);

  useEffect(() => {
    if (planPromptEdited.current) {
      doUpdatePlanPrompt.mutate({ planPrompt: debouncedPlanPrompt });
    }
  }, [debouncedPlanPrompt, doUpdatePlanPrompt.mutate]);

  if (isPending) {
    return <div>{m.common_loading()}</div>;
  }

  if (!userRes) {
    throw new Error("User data not available");
  }

  return (
    <div className="p-4 flex flex-col gap-2 md:gap-3">
      <Select value={locale} onChange={onLanguageChange}>
        <Label>{m.settings_language_label()}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ja">{m.language_name_japanese()}</ListBox.Item>
            <ListBox.Item id="en">{m.language_name_english()}</ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      <Label htmlFor="plan-prompt">{m.settings_plan_prompt_label()}</Label>
      <TextArea
        id="plan-prompt"
        value={planPrompt}
        onChange={(e) => {
          planPromptEdited.current = true;
          setPlanPrompt(e.target.value);
        }}
      />
      <Select
        value={settings.speakerDeviceId}
        onChange={onSpeakerChange}
        className="mt-4"
      >
        <Label>{m.settings_speaker_label()}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {speakers.map((speaker) => (
              <ListBox.Item key={speaker.deviceId} id={speaker.deviceId}>
                {speaker.label || m.settings_unknown_speaker()}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Select
        value={settings.microphoneDeviceId}
        onChange={onMicrophoneChange}
        className="mt-4"
      >
        <Label>{m.settings_microphone_label()}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {microphones.map((mic) => (
              <ListBox.Item key={mic.deviceId} id={mic.deviceId}>
                {mic.label || m.settings_unknown_microphone()}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Checkbox
        className="mt-4"
        isSelected={settings.useOpenAI}
        onChange={setUseOpenAI}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Use OpenAI
        </Checkbox.Content>
      </Checkbox>
      {settings.useOpenAI && (
        <Select
          value={settings.model}
          onChange={(model: Key | null) => {
            setModel(String(model ?? ""));
          }}
          className="mt-4"
        >
          <Label>{m.settings_model_label()}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="gpt-realtime-mini">
                gpt-realtime-2.1-mini
              </ListBox.Item>
              <ListBox.Item id="gpt-realtime">gpt-realtime-2.1</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      )}
    </div>
  );
}
