export type NavigationItem = {
  group?: string;
  href: string;
  icon?: string;
  label: string;
  requiredPermissions?: readonly string[];
};

export function visibleNavigation(
  items: readonly NavigationItem[],
  permissions: ReadonlySet<string>,
): NavigationItem[] {
  return items.filter(
    (item) =>
      !item.requiredPermissions ||
      item.requiredPermissions.every((permission) => permissions.has(permission)),
  );
}
