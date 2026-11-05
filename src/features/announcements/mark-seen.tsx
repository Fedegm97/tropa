"use client";

import { useEffect } from "react";
import { markAnnouncementsSeen } from "./actions";

export function MarkSeen({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (ids.length) markAnnouncementsSeen(ids).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
