import { ConvexError } from "convex/values";

export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "string") {
    return err.data;
  }
  return "Something went wrong. Try again.";
}
