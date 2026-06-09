import { supabase } from "@/integrations/supabase/client";

export type HrDriverDocField = "license_picture" | "passport_upload" | "photo_upload";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Could not read file"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export async function uploadHrDriverDocument(file: File, fieldName: HrDriverDocField): Promise<string> {
  const contentBase64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("upload-hr-driver-document", {
    body: {
      fieldName,
      fileName: file.name,
      contentBase64,
      mimeType: file.type || undefined,
    },
  });

  if (error) {
    let detail = error.message;
    try {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (body?.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const path = (data as { path?: string; error?: string })?.path;
  const fnError = (data as { error?: string })?.error;
  if (fnError) throw new Error(fnError);
  if (!path) throw new Error("Upload failed");

  return path;
}
