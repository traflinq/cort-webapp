/**
 * Company portal design system ("Navy rail"). Import everything from "@/app/company/ui".
 * Rules and examples: ./README.md
 */
export { focusRing, focusRingInset, controlBase, surface } from "./styles";
export { Button, IconButton, buttonClass, type ButtonProps, type IconButtonProps } from "./Button";
export { Tooltip, TooltipProvider } from "./Tooltip";
export { Field, FormGrid, Input, Select, Textarea, Checkbox, Switch, type InputProps, type SelectProps } from "./Form";
export { Badge, StatusBadge, useStatusLabel, type Tone } from "./Badge";
export { Card, CardHeader, CardBody, Section, DescriptionList } from "./Card";
export { Tabs, tabId, tabPanelId, type TabItem } from "./Tabs";
export { Dialog, Drawer, ConfirmProvider, useConfirm, type DialogProps, type DrawerProps, type ConfirmOptions } from "./Overlay";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  ActionMenu,
  type ActionMenuItem,
} from "./Menu";
export { EmptyState, ErrorState, Alert, Spinner, LoadingBlock, Skeleton, StatSkeleton, CardSkeleton, Toaster, ToneDot, type EmptyStateProps } from "./Feedback";
export { Pagination, type PaginationProps } from "./Pagination";
export { DataTable, sortRows, type Column, type DataTableProps, type SortState } from "./DataTable";
export { FilterBar, SearchInput, DateRangeField } from "./FilterBar";
export { StatCard, StatGrid, Delta, Meter, type StatCardProps } from "./Stat";
export { Page, PageHeader, type PageHeaderProps } from "./PageHeader";
export { useFormatters, type Formatters } from "./format";
export { useCompanyPath, CompanyLink } from "./link";
export { type Crumb } from "./shell/breadcrumbs";
