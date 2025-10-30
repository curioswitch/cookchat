import { Checkbox } from "@heroui/checkbox";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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

  const onLanguageChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await i18n.changeLanguage(e.target.value);
  }, []);

  const onSpeakerChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSpeakerDeviceId(e.target.value);
  }, []);

  const onMicrophoneChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMicrophoneDeviceId(e.target.value);
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
    <div className="p-4 max-w-md mx-auto">
      <div className="mb-6">
        <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
          {t("Language")}
        </label>
        <select
          id="language"
          value={i18n.language}
          onChange={onLanguageChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="ja">{t("Japanese")}</option>
          <option value="en">{t("English")}</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="speaker" className="block text-sm font-medium text-gray-700 mb-2">
          {t("Speaker")}
        </label>
        <select
          id="speaker"
          value={settings.speakerDeviceId}
          onChange={onSpeakerChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {speakers.map((speaker) => (
            <option key={speaker.deviceId} value={speaker.deviceId}>
              {speaker.label || t("Unknown Speaker")}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="microphone" className="block text-sm font-medium text-gray-700 mb-2">
          {t("Microphone")}
        </label>
        <select
          id="microphone"
          value={settings.microphoneDeviceId}
          onChange={onMicrophoneChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {microphones.map((mic) => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {mic.label || t("Unknown Microphone")}
            </option>
          ))}
        </select>
      </div>

      <Checkbox
        className="mt-4"
        isSelected={settings.useOpenAI}
        onValueChange={setUseOpenAI}
      >
        Use OpenAI
      </Checkbox>
    </div>
  );
}
