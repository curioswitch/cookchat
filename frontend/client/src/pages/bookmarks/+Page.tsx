import { useTranslation } from "react-i18next";

export default function Page() {
  const { t } = useTranslation();

  return <div className="p-4">{t("No Bookmarks")}</div>;
}
