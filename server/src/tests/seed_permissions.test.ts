import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { permissionsTable, rolePermissionsTable } from '../db/schema';
import { seedDefaultPermissions, assignDefaultRolePermissions } from '../handlers/seed_permissions';
import { eq, and } from 'drizzle-orm';

describe('seedDefaultPermissions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create all default permissions', async () => {
    const result = await seedDefaultPermissions();

    // Verify we created the expected number of permissions
    expect(result).toHaveLength(11);

    // Verify specific permissions exist
    const expectedPermissions = [
      'customers:read', 'customers:write', 'customers:delete',
      'staff:read', 'staff:write', 'staff:delete',
      'settings:read', 'settings:write',
      'billing:read', 'billing:write',
      'reports:read'
    ];

    const permissionNames = result.map(p => p.name);
    expectedPermissions.forEach(expectedName => {
      expect(permissionNames).toContain(expectedName);
    });

    // Verify permissions have correct structure
    result.forEach(permission => {
      expect(permission.id).toBeDefined();
      expect(permission.name).toBeDefined();
      expect(permission.resource).toBeDefined();
      expect(permission.action).toBeDefined();
      expect(permission.created_at).toBeInstanceOf(Date);
    });
  });

  it('should not duplicate permissions on multiple runs', async () => {
    // First run
    const firstResult = await seedDefaultPermissions();
    expect(firstResult).toHaveLength(11);

    // Second run
    const secondResult = await seedDefaultPermissions();
    expect(secondResult).toHaveLength(11);

    // Verify database only has 11 permissions total
    const allPermissions = await db.select()
      .from(permissionsTable)
      .execute();

    expect(allPermissions).toHaveLength(11);

    // Verify IDs are the same (no duplicates)
    const firstIds = firstResult.map(p => p.id).sort();
    const secondIds = secondResult.map(p => p.id).sort();
    expect(firstIds).toEqual(secondIds);
  });

  it('should save permissions to database correctly', async () => {
    await seedDefaultPermissions();

    // Query database directly
    const permissions = await db.select()
      .from(permissionsTable)
      .where(eq(permissionsTable.name, 'customers:read'))
      .execute();

    expect(permissions).toHaveLength(1);
    const permission = permissions[0];
    expect(permission.name).toBe('customers:read');
    expect(permission.resource).toBe('customers');
    expect(permission.action).toBe('read');
    expect(permission.description).toBe('View customer information');
  });

  it('should create permissions with different resources and actions', async () => {
    const result = await seedDefaultPermissions();

    // Verify we have multiple resources
    const resources = [...new Set(result.map(p => p.resource))];
    expect(resources).toContain('customers');
    expect(resources).toContain('staff');
    expect(resources).toContain('settings');
    expect(resources).toContain('billing');
    expect(resources).toContain('reports');

    // Verify we have multiple actions
    const actions = [...new Set(result.map(p => p.action))];
    expect(actions).toContain('read');
    expect(actions).toContain('write');
    expect(actions).toContain('delete');
  });
});

describe('assignDefaultRolePermissions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create role permission mappings for all roles', async () => {
    const result = await assignDefaultRolePermissions();

    // Verify we have mappings for all roles
    const rolePermissionsByRole = result.reduce((acc, rp) => {
      acc[rp.role] = (acc[rp.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(rolePermissionsByRole['SUPER_ADMIN']).toBe(11); // All permissions
    expect(rolePermissionsByRole['RESTAURANT_OWNER']).toBe(11); // All permissions
    expect(rolePermissionsByRole['MANAGER']).toBe(6); // Limited permissions
    expect(rolePermissionsByRole['STAFF']).toBe(2); // Very limited permissions
  });

  it('should assign correct permissions to SUPER_ADMIN', async () => {
    await assignDefaultRolePermissions();

    // Get all permissions for SUPER_ADMIN
    const superAdminPermissions = await db.select()
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permission_id, permissionsTable.id))
      .where(eq(rolePermissionsTable.role, 'SUPER_ADMIN'))
      .execute();

    const permissionNames = superAdminPermissions.map(result => result.permissions.name);

    // SUPER_ADMIN should have all permissions
    expect(permissionNames).toContain('customers:read');
    expect(permissionNames).toContain('customers:write');
    expect(permissionNames).toContain('customers:delete');
    expect(permissionNames).toContain('staff:read');
    expect(permissionNames).toContain('staff:write');
    expect(permissionNames).toContain('staff:delete');
    expect(permissionNames).toContain('settings:read');
    expect(permissionNames).toContain('settings:write');
    expect(permissionNames).toContain('billing:read');
    expect(permissionNames).toContain('billing:write');
    expect(permissionNames).toContain('reports:read');
  });

  it('should assign correct permissions to STAFF', async () => {
    await assignDefaultRolePermissions();

    // Get all permissions for STAFF
    const staffPermissions = await db.select()
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permission_id, permissionsTable.id))
      .where(eq(rolePermissionsTable.role, 'STAFF'))
      .execute();

    const permissionNames = staffPermissions.map(result => result.permissions.name);

    // STAFF should only have limited permissions
    expect(permissionNames).toContain('customers:read');
    expect(permissionNames).toContain('reports:read');
    expect(permissionNames).toHaveLength(2);

    // STAFF should NOT have write/delete permissions
    expect(permissionNames).not.toContain('customers:write');
    expect(permissionNames).not.toContain('customers:delete');
    expect(permissionNames).not.toContain('staff:write');
    expect(permissionNames).not.toContain('settings:write');
    expect(permissionNames).not.toContain('billing:read');
  });

  it('should assign correct permissions to MANAGER', async () => {
    await assignDefaultRolePermissions();

    // Get all permissions for MANAGER
    const managerPermissions = await db.select()
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permission_id, permissionsTable.id))
      .where(eq(rolePermissionsTable.role, 'MANAGER'))
      .execute();

    const permissionNames = managerPermissions.map(result => result.permissions.name);

    // MANAGER should have customer and staff management permissions
    expect(permissionNames).toContain('customers:read');
    expect(permissionNames).toContain('customers:write');
    expect(permissionNames).toContain('customers:delete');
    expect(permissionNames).toContain('staff:read');
    expect(permissionNames).toContain('staff:write');
    expect(permissionNames).toContain('reports:read');
    expect(permissionNames).toHaveLength(6);

    // MANAGER should NOT have settings/billing permissions or staff:delete
    expect(permissionNames).not.toContain('staff:delete');
    expect(permissionNames).not.toContain('settings:read');
    expect(permissionNames).not.toContain('settings:write');
    expect(permissionNames).not.toContain('billing:read');
    expect(permissionNames).not.toContain('billing:write');
  });

  it('should not duplicate role permissions on multiple runs', async () => {
    // First run
    const firstResult = await assignDefaultRolePermissions();
    const firstCount = firstResult.length;

    // Second run
    const secondResult = await assignDefaultRolePermissions();
    const secondCount = secondResult.length;

    expect(firstCount).toBe(secondCount);

    // Verify database doesn't have duplicates
    const allRolePermissions = await db.select()
      .from(rolePermissionsTable)
      .execute();

    expect(allRolePermissions).toHaveLength(firstCount);
  });

  it('should create permissions first if they do not exist', async () => {
    // Verify permissions table is empty initially
    const initialPermissions = await db.select()
      .from(permissionsTable)
      .execute();

    expect(initialPermissions).toHaveLength(0);

    // Run assignDefaultRolePermissions
    await assignDefaultRolePermissions();

    // Verify permissions were created
    const finalPermissions = await db.select()
      .from(permissionsTable)
      .execute();

    expect(finalPermissions).toHaveLength(11);

    // Verify role permissions were created
    const rolePermissions = await db.select()
      .from(rolePermissionsTable)
      .execute();

    expect(rolePermissions.length).toBeGreaterThan(0);
  });

  it('should handle role permission structure correctly', async () => {
    const result = await assignDefaultRolePermissions();

    // Verify role permission structure
    result.forEach(rolePermission => {
      expect(rolePermission.id).toBeDefined();
      expect(rolePermission.role).toBeDefined();
      expect(rolePermission.permission_id).toBeDefined();
      expect(rolePermission.created_at).toBeInstanceOf(Date);
      
      // Verify role is a valid enum value
      expect(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'MANAGER', 'STAFF']).toContain(rolePermission.role);
      
      // Verify permission_id references an actual permission
      expect(typeof rolePermission.permission_id).toBe('number');
      expect(rolePermission.permission_id).toBeGreaterThan(0);
    });
  });
});