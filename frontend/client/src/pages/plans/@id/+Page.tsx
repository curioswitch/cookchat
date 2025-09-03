import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { createValidator } from "@bufbuild/protovalidate";
import { useQuery } from "@connectrpc/connect-query";
import {
  GetPlanResponseSchema,
  getPlan,
  type StepGroup as StepGroupProto,
} from "@cookchat/frontend-api";
import { Image } from "@heroui/image";
import { useTranslation } from "react-i18next";
import { FaCheck, FaLightbulb, FaStar } from "react-icons/fa";
import { usePageContext } from "vike-react/usePageContext";

const validator = createValidator();

function StepGroup({ group }: { group: StepGroupProto }) {
  return (
    <div className="p-4">
      <div className="p-4 bg-white border-1 border-primary-400 rounded-2xl">
        <h3>{group.label}</h3>
        <div className="flex flex-col gap-4 mt-4">
          {group.steps.map((step, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
              key={i}
              className="border-l-6 border-primary p-4 bg-[#fff7ed] rounded-r-xl"
            >
              <h4 className="text-gray-600">{step.description}</h4>
              {step.imageUrl && (
                <img
                  src={step.imageUrl}
                  alt={step.description}
                  className="h-34 w-full object-cover rounded-xl mt-2"
                />
              )}
            </div>
          ))}
        </div>
        {group.note && (
          <div className="p-4 bg-[#fff7ed] mt-4 rounded-2xl border-1 border-primary-400 flex gap-2 items-center">
            <FaLightbulb className="flex-1/12 size-6 text-primary" />
            <div className="flex-11/12">{group.note}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const planid = pageContext.routeParams.id;

  const { data: planRes, isPending } = useQuery(getPlan, {
    date: timestampFromDate(new Date(planid)),
  });

  if (isPending) {
    return <div>{t("Loading...")}</div>;
  }

  if (!planRes) {
    return <div>{t("No plan found")}</div>;
  }

  const res = validator.validate(GetPlanResponseSchema, planRes);
  if (res.kind !== "valid") {
    return <div>{t("Invalid plan data")}</div>;
  }

  const plan = res.message.plan;

  return (
    <>
      <div>
        <div className="px-4 py-2 border-y-1 border-primary-400 bg-white">
          <h2 className="text-gray-600">{t("Today's Plan")}</h2>
          <div className="flex gap-4 justify-between">
            {plan.recipes.map((recipe) => (
              <div key={recipe.id} className="flex flex-col gap-2 items-center">
                <Image
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="h-20"
                />
                <div className="max-w-20 truncate text-tiny text-gray-600">
                  {recipe.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div>
        {plan.stepGroups.map((group, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
          <StepGroup key={i} group={group} />
        ))}
      </div>
      {plan.notes.length > 0 && (
        <div className="p-4">
          <div className="p-4 border-1 border-primary-400 rounded-2xl bg-linear-to-r from-[#ffedd5] to-[#fed7aa]">
            <div className="flex gap-2 items-center">
              <FaStar className="text-primary" />
              <div className="text-large">{t("Plan Notes")}</div>
            </div>
            <ol className="flex flex-col gap-2 mt-2">
              {plan.notes.map((note, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
                <li key={i} className="flex gap-2 items-center">
                  <FaCheck className="flex-1/12 size-3 text-primary" />
                  <div className="flex-11/12 text-gray-600 text-small ">
                    {note}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
