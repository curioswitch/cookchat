import { Select, SelectItem } from "@heroui/select";
import type { SharedSelection } from "@heroui/system";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { BackButton } from "../../components/BackButton";
import i18n from "../../layouts/i18n";

export default function Page() {
  const { t } = useTranslation();

  const onLanguageChange = useCallback(async (e: SharedSelection) => {
    await i18n.changeLanguage(e.currentKey);
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
          multiple={false}
          onSelectionChange={onLanguageChange}
        >
          <SelectItem key="ja">{t("Japanese")}</SelectItem>
          <SelectItem key="en">{t("English")}</SelectItem>
        </Select>
      </div>
    </div>
  );
}
