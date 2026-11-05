"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setOnboardingStep } from "@/features/clubs/actions";

export function NextStepButton({ step, href, children, variant = "primary" }: { step: number; href: string; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      block
      size="lg"
      variant={variant}
      loading={pending}
      onClick={() =>
        start(async () => {
          await setOnboardingStep(step);
          router.push(href);
        })
      }
    >
      {children}
    </Button>
  );
}
