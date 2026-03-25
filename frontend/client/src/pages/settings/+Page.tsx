import { Checkbox, type Key, Label, ListBox, Select } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import i18n from "../../layouts/i18n";
import {
  setMicrophoneDeviceId,
  setModel,
  setSpeakerDeviceId,
  setUseOpenAI,
  useSettingsStore,
} from "../../stores";

export default function Page() {
  const { t } = useTranslation();

  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);

  const settings = useSettingsStore();

  const onLanguageChange = useCallback(async (lang: Key | null) => {
    if (lang) {
      await i18n.changeLanguage(String(lang));
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

  return (
    <div className="p-4">
      <Select value={i18n.language} onChange={onLanguageChange}>
        <Label>{t("Language")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ja">{t("Japanese")}</ListBox.Item>
            <ListBox.Item id="en">{t("English")}</ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <Select
        value={settings.speakerDeviceId}
        onChange={onSpeakerChange}
        className="mt-4"
      >
        <Label>{t("Speaker")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {speakers.map((speaker) => (
              <ListBox.Item key={speaker.deviceId} id={speaker.deviceId}>
                {speaker.label || t("Unknown Speaker")}
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
        <Label>{t("Microphone")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {microphones.map((mic) => (
              <ListBox.Item key={mic.deviceId} id={mic.deviceId}>
                {mic.label || t("Unknown Microphone")}
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
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Use OpenAI
      </Checkbox>
      {settings.useOpenAI && (
        <Select
          value={settings.model}
          onChange={(model: Key | null) => {
            setModel(String(model ?? ""));
          }}
          className="mt-4"
        >
          <Label>{t("Model")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="gpt-realtime-mini">
                gpt-realtime-mini
              </ListBox.Item>
              <ListBox.Item id="gpt-realtime">gpt-realtime</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      )}
    </div>
  );
}
