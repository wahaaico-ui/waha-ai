"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const title = formData.get("title") as string;
  const ideaText = formData.get("ideaText") as string;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const initialSchemaData = {
    project_info: {
      project_id: crypto.randomUUID(),
      user_id: user.id,
      title: title,
      current_stage: "01_idea",
      updated_at: new Date().toISOString()
    },
    "01_idea": {
      raw_text: ideaText,
      status: "completed"
    },
    "02_gap": {
      identified_gap: "",
      status: "pending"
    },
    metadata: {
      version: "v1"
    }
  };

  const { error } = await supabase.from("projects").insert({
    user_id: user.id,
    title: title,
    schema_data: initialSchemaData
  });

  if (error) {
    console.error("Supabase Error:", error.message);
    throw new Error(error.message);
  }

  redirect("/dashboard");
}
