"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Template, TaskTemplateData, EventTemplateData, PlanTemplateData } from "@/lib/types";

type TemplateInsert = { name: string; type: "task" | "event" | "plan"; data: TaskTemplateData | EventTemplateData | PlanTemplateData };
type TemplateUpdate = { name?: string; data?: TaskTemplateData | EventTemplateData | PlanTemplateData };

export function useTemplates(userId: string | undefined) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("templates")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setTemplates(data as Template[]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addTemplate = useCallback(
    async (template: TemplateInsert) => {
      if (!userId) return;
      const sort_order = templates.length;
      const { data, error } = await supabase
        .from("templates")
        .insert({ ...template, user_id: userId, sort_order })
        .select()
        .single();
      if (!error && data) setTemplates((prev) => [...prev, data as Template]);
    },
    [userId, templates.length] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const updateTemplate = useCallback(
    async (id: string, updates: TemplateUpdate) => {
      const { data, error } = await supabase
        .from("templates")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (!error && data)
        setTemplates((prev) => prev.map((t) => (t.id === id ? (data as Template) : t)));
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("templates").delete().eq("id", id);
      if (!error) setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { templates, addTemplate, updateTemplate, deleteTemplate };
}
