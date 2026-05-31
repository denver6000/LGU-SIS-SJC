export type AppViewName =
  | "dashboard"
  | "catalogs"
  | "register"
  | "renewal"
  | "records"
  | "users"
  | "payrolls"
  | "trash";

export const APP_VIEWS: Array<{
  view: AppViewName;
  label: string;
  adminOnly?: boolean;
}> = [
  { view: "dashboard", label: "Dashboard" },
  { view: "catalogs", label: "Catalogs", adminOnly: true },
  { view: "register", label: "Registry", adminOnly: true },
  { view: "renewal", label: "Renewal" },
  { view: "records", label: "Records" },
  { view: "users", label: "Users", adminOnly: true },
  { view: "payrolls", label: "Payrolls" },
  { view: "trash", label: "Trash", adminOnly: true }
];

export function isAppViewName(value: string): value is AppViewName {
  return APP_VIEWS.some((item) => item.view === value);
}

export function isAdminOnlyView(view: AppViewName) {
  return APP_VIEWS.some((item) => item.view === view && item.adminOnly);
}

export function routeForView(view: AppViewName) {
  return `/${view}`;
}

export function labelForView(view: AppViewName) {
  return APP_VIEWS.find((item) => item.view === view)?.label || "Dashboard";
}
