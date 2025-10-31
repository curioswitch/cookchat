import { timestampDate } from "@bufbuild/protobuf/wkt";
import { createValidator } from "@bufbuild/protovalidate";
import { useQuery } from "@connectrpc/connect-query";
import {
  getPlans,
  PlanSnippetSchema,
  type PlanSnippetValid,
} from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaEdit } from "react-icons/fa";
import { navigate } from "vike/client/router";

import { enableEditPlan } from "../../stores";

const validator = createValidator();

function PlanSnippet({ plan }: { plan: PlanSnippetValid }) {
  const { t } = useTranslation();
  const date = timestampDate(plan.date);

  const onEditClick = useCallback(
    (e: React.MouseEvent) => {
      enableEditPlan(date.toISOString(), plan.recipes);
      navigate("/plans/edit");
      e.preventDefault();
    },
    [plan, date],
  );

  return (
    <Link href={`/plans/${timestampDate(plan.date).toUTCString()}`}>
      <div className="p-4 border-1 bg-white border-primary-400 text-black rounded-2xl">
        <div className="flex gap-4 justify-between items-center mb-2">
          <h3 className="mt-0 font-light">
            {t("global.dateOnly", {
              val: date,
            })}
          </h3>
          <FaEdit
            className="fill-primary-400 cursor-pointer"
            onClick={onEditClick}
          />
        </div>
        <div className="flex flex-col gap-4">
          {plan.recipes[0] && (
            <div className="block text-center p-2 border-1 border-gray-200 bg-gray-100 rounded-xl">
              <img
                className="mt-0 mb-2 rounded-lg w-full h-40 object-cover"
                src={plan.recipes[0].imageUrl}
                alt={plan.recipes[0].title}
              />
              <h5 className="text-base text-gray-600">
                {plan.recipes[0].title}
              </h5>
            </div>
          )}
          {plan.recipes.length > 1 && (
            <div className="grid grid-cols-2 gap-4">
              {plan.recipes.slice(1).map((recipe) => (
                <div
                  key={recipe.id}
                  className="block text-center p-2 border-1 border-gray-200 bg-gray-100 rounded-xl"
                >
                  <img
                    className="mt-0 mb-2 rounded-lg w-full h-28 object-cover"
                    src={recipe.imageUrl}
                    alt={recipe.title}
                  />
                  <h5 className="text-sm text-gray-600">{recipe.title}</h5>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const { data: plansRes, isPending } = useQuery(getPlans);

  if (isPending) {
    return <div>{t("Loading...")}</div>;
  }

  if (!plansRes) {
    return <div>{t("No plans found")}</div>;
  }

  const plans = plansRes.plans
    .map((p) => validator.validate(PlanSnippetSchema, p))
    .filter((r) => r.kind === "valid")
    .map((r) => r.message);

  return (
    <div className="pb-24">
      <div className="p-8 flex flex-col gap-4">
        {plans.map((plan) => (
          <PlanSnippet
            key={timestampDate(plan.date).toISOString()}
            plan={plan}
          />
        ))}
      </div>
      <div className="fixed bottom-24 left-0 right-0 z-10 py-4 px-8 flex justify-center">
        <Button
          as={Link}
          href="/plans/add"
          color="primary"
          className="w-full max-w-md"
        >
          {t("Add Plan")}
        </Button>
      </div>
    </div>
  );
}
