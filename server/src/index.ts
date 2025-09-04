import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema,
  loginInputSchema,
  createRestaurantInputSchema,
  updateRestaurantInputSchema,
  createCustomerInputSchema,
  updateCustomerInputSchema,
  getCustomersByRestaurantInputSchema,
  getStaffByRestaurantInputSchema,
  updateUserInputSchema,
  createSubscriptionInputSchema,
  userRoleSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { authenticateUser } from './handlers/authenticate_user';
import { createRestaurant } from './handlers/create_restaurant';
import { getRestaurant, getRestaurantByUserId } from './handlers/get_restaurant';
import { updateRestaurant } from './handlers/update_restaurant';
import { createCustomer } from './handlers/create_customer';
import { getCustomersByRestaurant, getCustomer } from './handlers/get_customers';
import { updateCustomer } from './handlers/update_customer';
import { getStaffByRestaurant, getStaffMember } from './handlers/get_staff';
import { updateUser } from './handlers/update_user';
import { createSubscription } from './handlers/create_subscription';
import { getSubscriptionByRestaurant } from './handlers/get_subscription';
import { getPermissionsByRole, getAllPermissions, getRolePermissions } from './handlers/get_permissions';
import { seedDefaultPermissions, assignDefaultRolePermissions } from './handlers/seed_permissions';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => authenticateUser(input)),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  // Restaurant management routes
  createRestaurant: publicProcedure
    .input(createRestaurantInputSchema)
    .mutation(({ input }) => createRestaurant(input)),

  getRestaurant: publicProcedure
    .input(z.number())
    .query(({ input }) => getRestaurant(input)),

  getRestaurantByUserId: publicProcedure
    .input(z.number())
    .query(({ input }) => getRestaurantByUserId(input)),

  updateRestaurant: publicProcedure
    .input(updateRestaurantInputSchema)
    .mutation(({ input }) => updateRestaurant(input)),

  // Customer management routes
  createCustomer: publicProcedure
    .input(createCustomerInputSchema)
    .mutation(({ input }) => createCustomer(input)),

  getCustomersByRestaurant: publicProcedure
    .input(getCustomersByRestaurantInputSchema)
    .query(({ input }) => getCustomersByRestaurant(input)),

  getCustomer: publicProcedure
    .input(z.object({
      customerId: z.number(),
      restaurantId: z.number()
    }))
    .query(({ input }) => getCustomer(input.customerId, input.restaurantId)),

  updateCustomer: publicProcedure
    .input(z.object({
      customer: updateCustomerInputSchema,
      restaurantId: z.number()
    }))
    .mutation(({ input }) => updateCustomer(input.customer, input.restaurantId)),

  // Staff management routes
  getStaffByRestaurant: publicProcedure
    .input(getStaffByRestaurantInputSchema)
    .query(({ input }) => getStaffByRestaurant(input)),

  getStaffMember: publicProcedure
    .input(z.object({
      userId: z.number(),
      restaurantId: z.number()
    }))
    .query(({ input }) => getStaffMember(input.userId, input.restaurantId)),

  // Subscription management routes
  createSubscription: publicProcedure
    .input(createSubscriptionInputSchema)
    .mutation(({ input }) => createSubscription(input)),

  getSubscriptionByRestaurant: publicProcedure
    .input(z.number())
    .query(({ input }) => getSubscriptionByRestaurant(input)),

  // Permission management routes
  getPermissionsByRole: publicProcedure
    .input(userRoleSchema)
    .query(({ input }) => getPermissionsByRole(input)),

  getAllPermissions: publicProcedure
    .query(() => getAllPermissions()),

  getRolePermissions: publicProcedure
    .query(() => getRolePermissions()),

  // System initialization routes (for super admin)
  seedDefaultPermissions: publicProcedure
    .mutation(() => seedDefaultPermissions()),

  assignDefaultRolePermissions: publicProcedure
    .mutation(() => assignDefaultRolePermissions())
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();