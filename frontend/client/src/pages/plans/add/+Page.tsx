import { Tabs } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { ChatPlan } from "./ChatPlan";
import { SimplePlan } from "./SimplePlan";

export default function Page() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white p-4">
      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List className="bg-white">
            <Tabs.Tab id="simple">
              {t("Simple Plan")}
              <Tabs.Indicator className="bg-yellow-400" />
            </Tabs.Tab>
            <Tabs.Tab id="deep-research">
              {t("Deep Research")}
              <Tabs.Indicator className="bg-yellow-400" />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <div className="bg-yellow-400/10 rounded-2xl p-4">
          <Tabs.Panel id="simple">
            <SimplePlan />
          </Tabs.Panel>
          <Tabs.Panel id="deep-research">
            <ChatPlan />
          </Tabs.Panel>
        </div>
      </Tabs>
    </div>
  );
}
