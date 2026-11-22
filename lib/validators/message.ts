import { z } from "zod";

const interactiveButtonSchema = z.object({
  type: z.literal("reply"),
  reply: z.object({
    id: z.string().max(256),
    title: z.string().max(20),
  }),
});

const interactiveListRowSchema = z.object({
  id: z.string().max(200),
  title: z.string().max(24),
  description: z.string().max(72).optional(),
});

const textHeaderSchema = z.object({ type: z.literal("text"), text: z.string().max(60) });

/**
 * A header may also be media, which Meta fetches from a link. A list is the exception —
 * Meta accepts a text header on one and nothing else.
 */
const mediaHeaderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("image"),    image:    z.object({ link: z.string().url() }) }),
  z.object({ type: z.literal("video"),    video:    z.object({ link: z.string().url() }) }),
  z.object({ type: z.literal("document"), document: z.object({ link: z.string().url(), filename: z.string().optional() }) }),
]);

const anyHeaderSchema = z.union([textHeaderSchema, mediaHeaderSchema]);
const footerSchema = z.object({ text: z.string().max(60) });

export const interactivePayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("button"),
    body: z.object({ text: z.string().min(1).max(1024) }),
    action: z.object({
      buttons: z.array(interactiveButtonSchema).min(1).max(3),
    }),
    header: anyHeaderSchema.optional(),
    footer: footerSchema.optional(),
  }),
  z.object({
    type: z.literal("list"),
    body: z.object({ text: z.string().min(1).max(4096) }),
    action: z.object({
      button: z.string().max(20),
      sections: z.array(z.object({
        title: z.string().max(24).optional(),
        rows: z.array(interactiveListRowSchema).min(1).max(10),
      })).min(1).max(10),
    }),
    header: textHeaderSchema.optional(),
    footer: footerSchema.optional(),
  }),
  // A link button. Nothing comes back from it — the customer leaves for the page.
  z.object({
    type: z.literal("cta_url"),
    body: z.object({ text: z.string().min(1).max(1024) }),
    action: z.object({
      name: z.literal("cta_url"),
      parameters: z.object({
        display_text: z.string().min(1).max(20),
        url: z.string().url(),
      }),
    }),
    header: anyHeaderSchema.optional(),
    footer: footerSchema.optional(),
  }),
  // The reply arrives as an ordinary location message, not as an interactive reply.
  z.object({
    type: z.literal("location_request_message"),
    body: z.object({ text: z.string().min(1).max(1024) }),
    action: z.object({ name: z.literal("send_location") }),
  }),
  // India and Singapore only; Meta refuses it for a customer anywhere else.
  z.object({
    type: z.literal("address_message"),
    body: z.object({ text: z.string().min(1).max(1024) }),
    action: z.object({
      name: z.literal("address_message"),
      parameters: z.object({
        country: z.enum(["IN", "SG"]),
        values: z.record(z.string(), z.unknown()).optional(),
      }),
    }),
  }),
  // Opens the catalogue connected to the number. Choosing individual products is the
  // Catalogue screen's `product` / `product_list`, which it sends itself.
  z.object({
    type: z.literal("catalog_message"),
    body: z.object({ text: z.string().min(1).max(1024) }),
    action: z.object({
      name: z.literal("catalog_message"),
      parameters: z.object({ thumbnail_product_retailer_id: z.string() }).optional(),
    }),
    footer: footerSchema.optional(),
  }),
]);

export type InteractivePayload = z.infer<typeof interactivePayloadSchema>;

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "TEMPLATE", "INTERACTIVE"]).default("TEXT"),
  content: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaId: z.string().optional(),
  mediaMimeType: z.string().optional(),
  mediaSize: z.number().int().positive().optional(),
  isNote: z.boolean().default(false),
  templateId: z.string().optional(),
  templateVariables: z.record(z.string(), z.string()).optional(),
  interactive: interactivePayloadSchema.optional(),
  replyToId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
