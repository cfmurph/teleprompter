"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

export function StoreHydration() {
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);
  return null;
}
