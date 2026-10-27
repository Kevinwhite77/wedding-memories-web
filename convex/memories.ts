import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// URL firmada para subir el archivo directo al storage de Convex.
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// Guarda el metadata después de subir el archivo.
export const save = mutation({
  args: {
    storageId: v.id("_storage"),
    guest: v.string(),
    message: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const guest = args.guest.trim().slice(0, 60) || "Invitado";
    const message = (args.message ?? "").trim().slice(0, 120);
    if (!args.mimeType.startsWith("image/") && !args.mimeType.startsWith("video/")) {
      throw new Error("Solo se permiten imágenes y videos.");
    }
    if (args.size > 100 * 1024 * 1024) {
      throw new Error("Archivo demasiado grande (máx 100 MB).");
    }
    return await ctx.db.insert("memories", {
      guest,
      message: message || undefined,
      fileName: args.fileName.slice(0, 200),
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
    });
  },
});

// Lista todos los recuerdos con URL pública temporal.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("memories").order("desc").collect();
    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      }))
    );
  },
});

// Elimina un recuerdo (archivo + metadata).
export const remove = mutation({
  args: { id: v.id("memories") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.id);
  },
});

// Elimina todo (uso del panel admin).
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("memories").collect();
    for (const doc of docs) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }
  },
});
