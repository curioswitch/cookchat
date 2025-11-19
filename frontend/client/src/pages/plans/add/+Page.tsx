import { Tab, Tabs } from "@heroui/tabs";
import { useTranslation } from "react-i18next";

import { ChatPlan } from "./ChatPlan";
import { SimplePlan } from "./SimplePlan";

export default function Page() {
  const { t } = useTranslation();

  return (
    <div className="p-4 h-full">
      <Tabs fullWidth color="primary">
        <Tab title={t("Simple Plan")}>
          <SimplePlan />
        </Tab>
        <Tab title={t("Deep Research")}>
          <ChatPlan />
        </Tab>
      </Tabs>
    </div>
  );
}
