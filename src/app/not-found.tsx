import { FileX } from "lucide-react";
import { ButtonLink } from "@/components/app/button";
import { EmptyState, Panel } from "@/components/app/layout";

/** Shown for a deleted or unknown batch, payment or page (replaces the framework's default black 404). */
export default function NotFound() {
  return (
    <Panel>
      <EmptyState
        icon={<FileX aria-hidden />}
        title="This batch or page doesn't exist"
        action={
          <ButtonLink href="/" variant="primary">
            Go to batches
          </ButtonLink>
        }
      >
        It may have been removed. Demo batches are cleared from time to time; start a new one with Use sample data.
      </EmptyState>
    </Panel>
  );
}
