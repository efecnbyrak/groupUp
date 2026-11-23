import { Suspense } from "react";

import { formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionForm, Alert, Card, Skeleton } from "@/components/ui";
import { getT } from "@/i18n/server";
import { createUniversityAction, getUniversityRequest } from "@/modules/university";

import { universityFields } from "../university-fields";

export const generateMetadata = titled("platform.universities.add");

async function Content({ searchParams }: PageProps<"/panel/platform/universiteler/yeni">) {
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const requestId = typeof sp.talep === "string" ? sp.talep : undefined;
  const request = requestId ? await getUniversityRequest(requestId) : null;
  const pending = request?.status === "PENDING" ? request : null;
  return (
    <>
      <PageHeader title={t("platform.universities.add")} description={t("platform.universities.addBody")} />
      {pending ? (
        <Alert tone="info" title={t("platform.requests.fromRequest")}>
          {t("platform.requests.fromRequestBody", { domain: pending.domain, email: pending.email })}
        </Alert>
      ) : null}
      <Card className="max-w-(--content-width-sm)">
        <ActionForm
          action={createUniversityAction}
          fields={[...universityFields(t, { name: pending?.name }), ...(pending ? [{ type: "hidden" as const, name: "requestId", value: pending.id }] : [])]}
          submitLabel={t("platform.universities.create")}
          loadingLabel={formLabels(t).loadingLabel}
        />
      </Card>
    </>
  );
}

export default function NewUniversityPage(props: PageProps<"/panel/platform/universiteler/yeni">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
