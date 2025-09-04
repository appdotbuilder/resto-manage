import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'MANAGER', 'STAFF']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['FREE', 'BASIC', 'PROFESSIONAL']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING']);

// Restaurants table (tenants)
export const restaurantsTable = pgTable('restaurants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  email: text('email').notNull(),
  phone: text('phone'), // Nullable
  address: text('address'), // Nullable
  logo_url: text('logo_url'), // Nullable
  brand_color: text('brand_color'), // Nullable, hex color code
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('STAFF'),
  restaurant_id: integer('restaurant_id'), // Nullable for super admins
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Subscriptions table
export const subscriptionsTable = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  restaurant_id: integer('restaurant_id').notNull(),
  tier: subscriptionTierEnum('tier').notNull().default('FREE'),
  status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripe_subscription_id: text('stripe_subscription_id'), // Nullable
  stripe_customer_id: text('stripe_customer_id'), // Nullable
  current_period_start: timestamp('current_period_start'), // Nullable
  current_period_end: timestamp('current_period_end'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Customers table
export const customersTable = pgTable('customers', {
  id: serial('id').primaryKey(),
  restaurant_id: integer('restaurant_id').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email'), // Nullable
  phone: text('phone'), // Nullable
  loyalty_points: integer('loyalty_points').notNull().default(0),
  total_visits: integer('total_visits').notNull().default(0),
  last_visit_date: timestamp('last_visit_date'), // Nullable
  notes: text('notes'), // Nullable
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Permissions table for granular access control
export const permissionsTable = pgTable('permissions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'), // Nullable
  resource: text('resource').notNull(), // e.g., 'customers', 'staff', 'settings'
  action: text('action').notNull(), // e.g., 'read', 'write', 'delete'
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Role permissions mapping table
export const rolePermissionsTable = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  role: userRoleEnum('role').notNull(),
  permission_id: integer('permission_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations
export const restaurantsRelations = relations(restaurantsTable, ({ many, one }) => ({
  users: many(usersTable),
  customers: many(customersTable),
  subscription: one(subscriptionsTable, {
    fields: [restaurantsTable.id],
    references: [subscriptionsTable.restaurant_id]
  })
}));

export const usersRelations = relations(usersTable, ({ one }) => ({
  restaurant: one(restaurantsTable, {
    fields: [usersTable.restaurant_id],
    references: [restaurantsTable.id]
  })
}));

export const subscriptionsRelations = relations(subscriptionsTable, ({ one }) => ({
  restaurant: one(restaurantsTable, {
    fields: [subscriptionsTable.restaurant_id],
    references: [restaurantsTable.id]
  })
}));

export const customersRelations = relations(customersTable, ({ one }) => ({
  restaurant: one(restaurantsTable, {
    fields: [customersTable.restaurant_id],
    references: [restaurantsTable.id]
  })
}));

export const rolePermissionsRelations = relations(rolePermissionsTable, ({ one }) => ({
  permission: one(permissionsTable, {
    fields: [rolePermissionsTable.permission_id],
    references: [permissionsTable.id]
  })
}));

// TypeScript types for the table schemas
export type Restaurant = typeof restaurantsTable.$inferSelect;
export type NewRestaurant = typeof restaurantsTable.$inferInsert;

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type NewSubscription = typeof subscriptionsTable.$inferInsert;

export type Customer = typeof customersTable.$inferSelect;
export type NewCustomer = typeof customersTable.$inferInsert;

export type Permission = typeof permissionsTable.$inferSelect;
export type NewPermission = typeof permissionsTable.$inferInsert;

export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type NewRolePermission = typeof rolePermissionsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  restaurants: restaurantsTable,
  users: usersTable,
  subscriptions: subscriptionsTable,
  customers: customersTable,
  permissions: permissionsTable,
  rolePermissions: rolePermissionsTable
};

export const tableRelations = {
  restaurantsRelations,
  usersRelations,
  subscriptionsRelations,
  customersRelations,
  rolePermissionsRelations
};