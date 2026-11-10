import { z } from "zod";
import { ENTITY_STATUSES } from "../domain";
import {
  leadTimeField,
  nameField,
  optionalEmailField,
  optionalFilter,
  paginationQuery,
} from "./common";

/** An optional free-text field: absent, empty, or up to `max` characters. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .or(z.literal(""));

/** 9 — supplier name 2–150 characters, email valid if supplied, lead time 0–365. */
export const supplierSchema = z.object({
  name: nameField,
  contact_person: optionalText(100),
  email: optionalEmailField,
  phone: optionalText(30),
  address: optionalText(255),
  lead_time_days: leadTimeField,
  status: z.enum(ENTITY_STATUSES).default("active"),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierStatusSchema = z.object({
  status: z.enum(ENTITY_STATUSES),
});

export const SUPPLIER_SORT_KEYS = ["name", "lead_time_days", "status"] as const;
export type SupplierSortKey = (typeof SUPPLIER_SORT_KEYS)[number];

export const supplierQuerySchema = paginationQuery.extend({
  status: optionalFilter(z.enum(ENTITY_STATUSES)),
  sort: z.enum(SUPPLIER_SORT_KEYS).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type SupplierQuery = z.infer<typeof supplierQuerySchema>;
