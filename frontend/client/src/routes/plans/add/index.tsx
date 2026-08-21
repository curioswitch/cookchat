import { Tabs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { m } from "../../../paraglide/messages";

import { ChatPlan } from "./-ChatPlan";
import { SimplePlan } from "./-SimplePlan";

export const Route = createFileRoute("/plans/add/")({
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-white p-4">
      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List className="bg-white">
            <Tabs.Tab id="simple">
              {m.plan_simple_mode()}
              <Tabs.Indicator className="bg-yellow-400" />
            </Tabs.Tab>
            <Tabs.Tab id="deep-research">
              {m.plan_chat_mode()}
              <Tabs.Indicator className="bg-yellow-400" />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <div className="min-w-0 max-w-full overflow-x-hidden bg-yellow-400/10 rounded-2xl p-4">
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
