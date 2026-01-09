import { Tab, Tabs } from "@heroui/tabs";
import { useTranslation } from "react-i18next";

import { ChatPlan } from "./ChatPlan";
import { SimplePlan } from "./SimplePlan";

export default function Page() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white p-4">
      <Tabs
        fullWidth
        color="primary"
        classNames={{
          tabList: "bg-white p-1 rounded-2xl",
          tab: "data-[selected=true]:bg-primary-400 data-[selected=true]:text-white",
          cursor: "bg-primary-400",
        }}
      >
        <Tab title={t("Simple Plan")}>
          <div className="bg-primary-400/10 rounded-2xl p-4">
            <SimplePlan />
          </div>
        </Tab>
        <Tab title={t("Deep Research")}>
          <div className="bg-primary-400/10 rounded-2xl p-4">
            <ChatPlan />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
