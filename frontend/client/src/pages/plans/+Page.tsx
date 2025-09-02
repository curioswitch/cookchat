import { timestampDate } from "@bufbuild/protobuf/wkt";
import { createValidator } from "@bufbuild/protovalidate";
import { useQuery } from "@connectrpc/connect-query";
import { getPlans, PlanSchema, type PlanValid } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { useTranslation } from "react-i18next";

const validator = createValidator();

function PlanSnippet({ plan }: { plan: PlanValid }) {
  const { t } = useTranslation();
  const date = timestampDate(plan.date);

  return (
    <div className="p-4 border-1 border-primary-400 rounded-2xl">
      <h3 className="mt-0 font-light">
        {t("global.dateOnly", {
          val: date,
        })}
      </h3>
      <div className="flex gap-2">
        {plan.recipes.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recipes/${recipe.id}`}
            color="foreground"
            className="block text-center p-4 border-1 border-gray-200 bg-gray-100 rounded-xl w-1/3"
          >
            <img
              className="mt-0 mb-2 rounded-sm"
              src={recipe.imageUrl}
              alt={recipe.title}
            />
            <h5 className="text-tiny">{recipe.title}</h5>
          </Link>
        ))}
      </div>
    </div>
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
    .map((p) => validator.validate(PlanSchema, p))
    .filter((r) => r.kind === "valid")
    .map((r) => r.message);

  return (
    <div>
      <div className="p-8 flex flex-col gap-4">
        <Button as={Link} href="/plans/add" color="primary">
          {t("Add Plan")}
        </Button>
        {plans.map((plan) => (
          <PlanSnippet
            key={timestampDate(plan.date).toISOString()}
            plan={plan}
          />
        ))}
      </div>
    </div>
  );
}
