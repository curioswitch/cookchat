export function getPlanNavigationState(path: string) {
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const isPlanCreate = normalizedPath === "/plans/add";

  return {
    isPlanCreate,
    isPlanView: normalizedPath.startsWith("/plans") && !isPlanCreate,
  };
}
