import { z } from 'zod';

// Enum definitions for role-based access control
export const userRoleSchema = z.enum(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'MANAGER', 'STAFF']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const subscriptionTierSchema = z.enum(['FREE', 'BASIC', 'PROFESSIONAL']);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const subscriptionStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  restaurant_id: z.number().nullable(), // Super admins don't belong to a restaurant
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Restaurant (Tenant) schema
export const restaurantSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  logo_url: z.string().nullable(),
  brand_color: z.string().nullable(), // Hex color code
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Restaurant = z.infer<typeof restaurantSchema>;

// Subscription schema
export const subscriptionSchema = z.object({
  id: z.number(),
  restaurant_id: z.number(),
  tier: subscriptionTierSchema,
  status: subscriptionStatusSchema,
  stripe_subscription_id: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  current_period_start: z.coerce.date().nullable(),
  current_period_end: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Subscription = z.infer<typeof subscriptionSchema>;

// Customer schema
export const customerSchema = z.object({
  id: z.number(),
  restaurant_id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  loyalty_points: z.number().int(),
  total_visits: z.number().int(),
  last_visit_date: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Customer = z.infer<typeof customerSchema>;

// Permission schema for granular access control
export const permissionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  resource: z.string(), // e.g., 'customers', 'staff', 'settings'
  action: z.string(), // e.g., 'read', 'write', 'delete'
  created_at: z.coerce.date()
});

export type Permission = z.infer<typeof permissionSchema>;

// Role permissions mapping
export const rolePermissionSchema = z.object({
  id: z.number(),
  role: userRoleSchema,
  permission_id: z.number(),
  created_at: z.coerce.date()
});

export type RolePermission = z.infer<typeof rolePermissionSchema>;

// Input schemas for creating entities

// User registration/creation
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: userRoleSchema.optional(), // Default will be set by business logic
  restaurant_id: z.number().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Restaurant creation
export const createRestaurantInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  brand_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).nullable().optional() // Hex color validation
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantInputSchema>;

// Customer creation
export const createCustomerInputSchema = z.object({
  restaurant_id: z.number(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

// Subscription creation
export const createSubscriptionInputSchema = z.object({
  restaurant_id: z.number(),
  tier: subscriptionTierSchema,
  stripe_customer_id: z.string().optional()
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionInputSchema>;

// Update schemas

// User update
export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  role: userRoleSchema.optional(),
  restaurant_id: z.number().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Restaurant update
export const updateRestaurantInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  brand_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantInputSchema>;

// Customer update
export const updateCustomerInputSchema = z.object({
  id: z.number(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  loyalty_points: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;

// Authentication schemas
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Query schemas
export const getCustomersByRestaurantInputSchema = z.object({
  restaurant_id: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetCustomersByRestaurantInput = z.infer<typeof getCustomersByRestaurantInputSchema>;

export const getStaffByRestaurantInputSchema = z.object({
  restaurant_id: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetStaffByRestaurantInput = z.infer<typeof getStaffByRestaurantInputSchema>;