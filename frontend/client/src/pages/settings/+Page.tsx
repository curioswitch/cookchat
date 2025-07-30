import { Checkbox } from "@heroui/checkbox";
import { Select, SelectItem } from "@heroui/select";
import type { SharedSelection } from "@heroui/system";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { BackButton } from "../../components/BackButton";
import i18n from "../../layouts/i18n";
import {
  setMicrophoneDeviceId,
  setSpeakerDeviceId,
  setUseOpenAI,
  useSettingsStore,
} from "../../stores";

export default function Page() {
  const { t } = useTranslation();

  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);

  const settings = useSettingsStore();

  const onLanguageChange = useCallback(async (e: SharedSelection) => {
    await i18n.changeLanguage(e.currentKey);
  }, []);

  const onSpeakerChange = useCallback(async (e: SharedSelection) => {
    if (e.currentKey) {
      setSpeakerDeviceId(e.currentKey);
    }
  }, []);

  const onMicrophoneChange = useCallback(async (e: SharedSelection) => {
    if (e.currentKey) {
      setMicrophoneDeviceId(e.currentKey);
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
    <div>
      <div className="flex items-center justify-between gap-2 pb-2 p-2">
        <BackButton className="size-6" />
        <h1 className="text-2xl font-semibold mb-0">{t("Settings")}</h1>
        <div className="size-6" />
      </div>
      <div className="p-4">
        <Select
          label={t("Language")}
          labelPlacement="outside-left"
          selectedKeys={[i18n.language]}
          onSelectionChange={onLanguageChange}
        >
          <SelectItem key="ja">{t("Japanese")}</SelectItem>
          <SelectItem key="en">{t("English")}</SelectItem>
        </Select>
        <Select
          label={t("Speaker")}
          labelPlacement="outside-left"
          selectedKeys={[settings.speakerDeviceId]}
          onSelectionChange={onSpeakerChange}
          className="mt-4"
        >
          {speakers.map((speaker) => (
            <SelectItem key={speaker.deviceId}>
              {speaker.label || t("Unknown Speaker")}
            </SelectItem>
          ))}
        </Select>
        <Select
          label={t("Microphone")}
          labelPlacement="outside-left"
          selectedKeys={[settings.microphoneDeviceId]}
          onSelectionChange={onMicrophoneChange}
          className="mt-4"
        >
          {microphones.map((mic) => (
            <SelectItem key={mic.deviceId}>
              {mic.label || t("Unknown Microphone")}
            </SelectItem>
          ))}
        </Select>
        <Checkbox
          className="mt-4"
          isSelected={settings.useOpenAI}
          onValueChange={setUseOpenAI}
        >
          Use OpenAI
        </Checkbox>
      </div>
    </div>
  );
}
