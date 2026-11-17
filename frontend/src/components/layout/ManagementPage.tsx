import type { ReactNode } from "react";
import {
  ButtonLink,
  Card,
  PageHeader
} from "@/components/ui";

interface ManagementPageProps {
  title: string;
  description: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export default function ManagementPage({
  title,
  description,
  children,
  backHref,
  backLabel = "Back"
}: ManagementPageProps) {
  return (
    <section className="finops-ui-page">
      <PageHeader
        title={title}
        description={description}
        action={
          backHref ? (
            <ButtonLink
              href={backHref}
              variant="secondary"
              icon="arrow_back"
            >
              {backLabel}
            </ButtonLink>
          ) : undefined
        }
      />

      <Card>
        {children}
      </Card>
    </section>
  );
}