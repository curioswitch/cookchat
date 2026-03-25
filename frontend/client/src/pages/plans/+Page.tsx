import { timestampDate } from "@bufbuild/protobuf/wkt";
import { createValidator } from "@bufbuild/protovalidate";
import { useMutation } from "@connectrpc/connect-query";
import {
  deletePlan,
  PlanSnippetSchema,
  type PlanSnippetValid,
} from "@cookchat/frontend-api";
import { Button, Link } from "@heroui/react";
import { Temporal } from "@js-temporal/polyfill";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaEdit, FaTrash } from "react-icons/fa";
import { twMerge } from "tailwind-merge";
import { navigate } from "vike/client/router";

import { useFrontendQueries } from "../../hooks/rpc";
import { enableEditPlan } from "../../stores";

const validator = createValidator();

function PlanSnippet({
  plan,
  invalidatePlans,
}: {
  plan: PlanSnippetValid;
  invalidatePlans: () => void;
}) {
  const { t } = useTranslation();

  const doDeletePlan = useMutation(deletePlan, {
    onSuccess: () => {
      invalidatePlans();
    },
  });

  const onDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      doDeletePlan.mutate({ planId: plan.id });
      e.preventDefault();
      e.stopPropagation();
    },
    [doDeletePlan, plan.id],
  );

  const onEditClick = useCallback(
    (e: React.MouseEvent) => {
      console.log("foo");
      enableEditPlan(plan.id, plan.recipes);
      navigate(`/plans/${plan.id}/edit`);
      e.preventDefault();
      e.stopPropagation();
    },
    [plan],
  );

  return (
    <a href={`/plans/${plan.id}`}>
      <div className="p-4 border-1 bg-white border-yellow-400 text-black rounded-2xl">
        <div className="flex gap-4 justify-between items-center mb-2">
          <h3 className="mt-0 font-light">
            {t("global.dateOnly", {
              val: timestampDate(plan.date),
            })}
          </h3>
          <div className="flex gap-4">
            <FaEdit
              className="fill-yellow-400 cursor-pointer"
              onClick={onEditClick}
            />
            <FaTrash
              className="fill-yellow-400 cursor-pointer"
              onClick={onDeleteClick}
            />
          </div>
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
    </a>
  );
}

interface DatePlans {
  date: Temporal.PlainDate;
  plans: PlanSnippetValid[];
}

function DateSelect({
  plans,
  invalidatePlans,
}: {
  plans: PlanSnippetValid[];
  invalidatePlans: () => void;
}) {
  const { t, i18n } = useTranslation();

  const today = useMemo(() => Temporal.Now.plainDateISO(), []);

  const [selectedDate, setSelectedDate] = useState<Temporal.PlainDate>(today);

  const onDateClick = useCallback((event: React.MouseEvent) => {
    const dateStr = (event.currentTarget as HTMLDivElement).dataset.date;
    if (dateStr) {
      setSelectedDate(Temporal.PlainDate.from(dateStr));
    }
  }, []);

  const dates: DatePlans[] = useMemo(() => {
    const dates: DatePlans[] = [
      { date: today.subtract({ days: 3 }), plans: [] },
      { date: today.subtract({ days: 2 }), plans: [] },
      { date: today.subtract({ days: 1 }), plans: [] },
      { date: today, plans: [] },
      { date: today.add({ days: 1 }), plans: [] },
      { date: today.add({ days: 2 }), plans: [] },
      { date: today.add({ days: 3 }), plans: [] },
    ];

    for (const plan of plans) {
      const date = Temporal.Instant.fromEpochMilliseconds(
        timestampDate(plan.date).getTime(),
      )
        .toZonedDateTimeISO(Temporal.Now.timeZoneId())
        .toPlainDate();
      const datePlan = dates.find((d) => d.date.equals(date));
      if (datePlan) {
        datePlan.plans.push(plan);
      }
    }
    return dates;
  }, [today, plans]);

  const selectedPlans = useMemo(
    () => dates.find((d) => d.date.equals(selectedDate))?.plans ?? [],
    [dates, selectedDate],
  );
  const month = today.toLocaleString(i18n.language, { month: "long" });

  return (
    <div>
      <div className="p-4 bg-white">
        <h2 className="text-gray-600 text-large mb-4">
          {t("This Month's Plans", { month })}
        </h2>
        <div className="flex flex-row justify-between">
          {dates.map(({ date, plans }) => (
            <div
              key={date.toString()}
              className="flex flex-col gap-2 items-center"
            >
              <div className="text-gray-400">
                {date.toLocaleString(i18n.language, { weekday: "short" })}
              </div>
              <button
                type="button"
                className={twMerge(
                  "p-1 md:p-10 cursor-pointer",
                  plans.length > 0 && "border-3 rounded-xl border-orange-400",
                )}
                data-date={date.toString()}
                onClick={onDateClick}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={twMerge(
                      "bg-orange-500 text-white! px-1 py-1 text-xs rounded",
                      plans.length === 0 && "invisible",
                    )}
                  >
                    {t("Plan")}
                  </div>
                  <div
                    className={twMerge(
                      date.equals(selectedDate)
                        ? "text-orange-500"
                        : "text-gray-600",
                    )}
                  >
                    {date.day}
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {selectedPlans.map((plan) => (
          <PlanSnippet
            key={plan.id}
            plan={plan}
            invalidatePlans={invalidatePlans}
          />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const queries = useFrontendQueries();
  const getPlansQuery = queries.getPlans();

  const invalidatePlans = useCallback(() => {
    console.log("invalidating plans");
    console.log(getPlansQuery.queryKey);
    queryClient.invalidateQueries({
      queryKey: getPlansQuery.queryKey,
    });
  }, [queryClient, getPlansQuery]);

  const { data: plansRes, isPending } = useQuery(getPlansQuery);

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
    <>
      <DateSelect plans={plans} invalidatePlans={invalidatePlans} />
      <div className="flex justify-center">
        <Link href="/plans/add" className="block fixed bottom-30">
          <Button className="text-white bg-orange-400">{t("Add Plan")}</Button>
        </Link>
      </div>
    </>
  );
}
