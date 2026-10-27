import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  memories: defineTable({
    guest: v.string(),
    message: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
  }),
});
