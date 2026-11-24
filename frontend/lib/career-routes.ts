// Only Step 7b browsing is public; apply and every other route stay guarded.
export function isPublicCareerRoute(pathname: string | null): boolean {
  return Boolean(pathname && (/^\/jobseeker\/jobs(?:\/[^/]+)?\/?$/.test(pathname) || /^\/jobseeker\/companies\/[^/]+\/?$/.test(pathname) || /^\/jobseeker\/startups\/?$/.test(pathname)));
}
