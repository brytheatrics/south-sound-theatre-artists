// Dev-only test harness for the headshot uploader.
import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

export const load = () => {
  if (!dev) error(404, "Not found");
  return {};
};
