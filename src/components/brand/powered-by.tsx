import { PLATFORM_NAME, ROOT_DOMAIN } from "@/lib/env";
import { rootOrigin } from "@/lib/hosts";

export function PoweredBy() {
  return (
    <p className="py-6 text-center font-mono text-[11px] text-subtle">
      con tecnología de{" "}
      <a href={rootOrigin(ROOT_DOMAIN)} className="underline-offset-2 hover:underline">
        {PLATFORM_NAME}
      </a>
    </p>
  );
}
