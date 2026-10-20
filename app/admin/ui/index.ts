/**
 * Admin design system — import from "@/app/admin/ui".
 * Every primitive is theme-aware (light/dark), keyboard-operable, and labelled.
 */
export { focusRing, focusRingInset, inputBase, surface } from "./styles";

export { Button, buttonVariants, type ButtonProps } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";
export { Tooltip, TooltipProvider } from "./Tooltip";

export { Input, type InputProps } from "./Input";
export { Textarea } from "./Textarea";
export { Select, type SelectProps } from "./Select";
export { Checkbox } from "./Checkbox";
export { Switch, type SwitchProps } from "./Switch";
export { Label } from "./Label";
export { Field, FormGrid, useFieldContext } from "./Field";

export { Badge, toneDot, type BadgeTone, type BadgeVariant, type BadgeProps } from "./Badge";
export { StatusBadge, STATUS_REGISTRY, statusTone, statusKey, type StatusEntry } from "./StatusBadge";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./Card";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription, dialogZ, type DialogSize, type DialogPriority } from "./Dialog";
export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, type DrawerSize } from "./Drawer";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  ActionMenu,
  type ActionMenuItem,
} from "./DropdownMenu";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose } from "./Popover";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { AdminToaster } from "./Toast";

export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, InlineError } from "./ErrorState";
export { Skeleton, TableSkeletonRows, CardSkeleton, KpiSkeleton, PageSkeleton } from "./Skeleton";
export { Spinner, LoadingBlock } from "./Spinner";
export { RefreshButton, type RefreshButtonProps } from "./RefreshButton";
export { Pagination, type PaginationProps } from "./Pagination";
export { DataTable, sortRows, type DataTableColumn, type DataTableProps, type SortState, type SortDir, type RowKey } from "./DataTable";
export { FilterBar, FilterField, FilterChip, SearchInput } from "./FilterBar";
export { DateRangePicker, defaultPresets, type DateRange, type DateRangePreset } from "./DateRangePicker";
export { KpiCard, KpiGrid, type KpiCardProps, type KpiDelta } from "./KpiCard";
export { ChartCard, ChartLegend, ChartTooltip, type ChartLegendItem } from "./ChartCard";
export { useChartTheme, axisProps, gridProps, CHART_COLORS_LIGHT, CHART_COLORS_DARK } from "./chart-theme";
export { PageHeader, Breadcrumbs, SectionHeader, type Crumb } from "./PageHeader";
export { usePageBreadcrumbs } from "./shell/breadcrumbs-context";
