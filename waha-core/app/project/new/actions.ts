"use server";

import { createClient } from "@/src/utils/supabase/server";
import { redirect } from "next/navigation";

export async function createProject(formData: FormData) {
  const title = formData.get("title") as string;
  if (!title) return;

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert([{ title }]);

  if (error) {
    console.error("Supabase Error:", error);
    throw new Error(error.message);
  }

  redirect("/dashboard");
}