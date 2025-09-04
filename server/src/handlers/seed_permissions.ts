import { db } from '../db';
import { permissionsTable, rolePermissionsTable } from '../db/schema';
import { type Permission, type RolePermission, type UserRole } from '../schema';
import { eq, and } from 'drizzle-orm';

// Default permissions for the system
const DEFAULT_PERMISSIONS = [
  // Customer management
  { name: 'customers:read', description: 'View customer information', resource: 'customers', action: 'read' },
  { name: 'customers:write', description: 'Create and update customer information', resource: 'customers', action: 'write' },
  { name: 'customers:delete', description: 'Delete customer records', resource: 'customers', action: 'delete' },
  
  // Staff management
  { name: 'staff:read', description: 'View staff information', resource: 'staff', action: 'read' },
  { name: 'staff:write', description: 'Create and update staff information', resource: 'staff', action: 'write' },
  { name: 'staff:delete', description: 'Delete staff records', resource: 'staff', action: 'delete' },
  
  // Settings management
  { name: 'settings:read', description: 'View restaurant settings', resource: 'settings', action: 'read' },
  { name: 'settings:write', description: 'Modify restaurant settings', resource: 'settings', action: 'write' },
  
  // Billing management
  { name: 'billing:read', description: 'View billing information', resource: 'billing', action: 'read' },
  { name: 'billing:write', description: 'Manage billing and subscriptions', resource: 'billing', action: 'write' },
  
  // Reports
  { name: 'reports:read', description: 'View reports and analytics', resource: 'reports', action: 'read' }
];

// Role permission mappings
const ROLE_PERMISSION_MAPPINGS: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    'customers:read', 'customers:write', 'customers:delete',
    'staff:read', 'staff:write', 'staff:delete',
    'settings:read', 'settings:write',
    'billing:read', 'billing:write',
    'reports:read'
  ],
  RESTAURANT_OWNER: [
    'customers:read', 'customers:write', 'customers:delete',
    'staff:read', 'staff:write', 'staff:delete',
    'settings:read', 'settings:write',
    'billing:read', 'billing:write',
    'reports:read'
  ],
  MANAGER: [
    'customers:read', 'customers:write', 'customers:delete',
    'staff:read', 'staff:write',
    'reports:read'
  ],
  STAFF: [
    'customers:read',
    'reports:read'
  ]
};

export const seedDefaultPermissions = async (): Promise<Permission[]> => {
  try {
    const createdPermissions: Permission[] = [];

    for (const permissionData of DEFAULT_PERMISSIONS) {
      // Check if permission already exists
      const existingPermission = await db.select()
        .from(permissionsTable)
        .where(eq(permissionsTable.name, permissionData.name))
        .execute();

      if (existingPermission.length === 0) {
        // Create new permission
        const result = await db.insert(permissionsTable)
          .values({
            name: permissionData.name,
            description: permissionData.description,
            resource: permissionData.resource,
            action: permissionData.action
          })
          .returning()
          .execute();

        createdPermissions.push(result[0]);
      } else {
        createdPermissions.push(existingPermission[0]);
      }
    }

    return createdPermissions;
  } catch (error) {
    console.error('Permission seeding failed:', error);
    throw error;
  }
};

export const assignDefaultRolePermissions = async (): Promise<RolePermission[]> => {
  try {
    // First ensure permissions exist
    await seedDefaultPermissions();

    // Get all permissions with their IDs
    const allPermissions = await db.select()
      .from(permissionsTable)
      .execute();

    const permissionMap = new Map<string, number>();
    allPermissions.forEach(permission => {
      permissionMap.set(permission.name, permission.id);
    });

    const createdRolePermissions: RolePermission[] = [];

    // Create role permission mappings
    for (const [role, permissionNames] of Object.entries(ROLE_PERMISSION_MAPPINGS)) {
      for (const permissionName of permissionNames) {
        const permissionId = permissionMap.get(permissionName);
        
        if (!permissionId) {
          console.warn(`Permission ${permissionName} not found for role ${role}`);
          continue;
        }

        // Check if role permission mapping already exists
        const existingRolePermission = await db.select()
          .from(rolePermissionsTable)
          .where(
            and(
              eq(rolePermissionsTable.role, role as UserRole),
              eq(rolePermissionsTable.permission_id, permissionId)
            )
          )
          .execute();

        if (existingRolePermission.length === 0) {
          // Create new role permission mapping
          const result = await db.insert(rolePermissionsTable)
            .values({
              role: role as UserRole,
              permission_id: permissionId
            })
            .returning()
            .execute();

          createdRolePermissions.push(result[0]);
        } else {
          createdRolePermissions.push(existingRolePermission[0]);
        }
      }
    }

    return createdRolePermissions;
  } catch (error) {
    console.error('Role permission assignment failed:', error);
    throw error;
  }
};