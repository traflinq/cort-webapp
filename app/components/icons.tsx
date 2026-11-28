/**
 * The single source of icons for the whole webapp.
 *
 * Every icon comes from Hugeicons (free "Stroke Rounded" set). Components
 * import icons from here — never from `@hugeicons/*` directly — so swapping
 * a glyph, or the whole library, only ever touches this file.
 *
 * The exported names are the app's own semantic names (they started out as
 * the Lucide names, which kept the migration a pure import-path change). To
 * add an icon: find it at https://hugeicons.com/icons (filter: Free, Stroke
 * Rounded), import `<Name>Icon` from `@hugeicons/core-free-icons` below and
 * export it through `createIcon`.
 */
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { HugeiconsIcon, type HugeiconsProps, type IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  AlertCircleIcon,
  Analytics01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  ArrowDown02Icon,
  ArrowDownRight01Icon,
  ArrowExpand01Icon,
  ArrowLeft01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowShrink02Icon,
  ArrowUp02Icon,
  ArrowUpDownIcon,
  ArrowUpRight01Icon,
  BankIcon,
  Building03Icon,
  Bus03Icon,
  BulbIcon,
  Calculator01Icon,
  Calendar03Icon,
  Calendar04Icon,
  CalendarAdd01Icon,
  CalendarCheck01Icon,
  CalendarClockIcon,
  Call02Icon,
  CancelCircleIcon,
  Cancel01Icon,
  Car01Icon,
  Car03Icon,
  ChartColumnIcon,
  CheckmarkCircle02Icon,
  CircleDashedIcon,
  Clock01Icon,
  Coins01Icon,
  Copy01Icon,
  CornerDownLeftIcon,
  CreditCardIcon,
  CrosshairIcon,
  DashboardSquare02Icon,
  Delete01Icon,
  Delete02Icon,
  DeliveryTruck01Icon,
  DollarCircleIcon,
  Download01Icon,
  DragDropVerticalIcon,
  DropletsIcon,
  FileAddIcon,
  FileChartColumnIcon,
  FileDownloadIcon,
  FileExclamationPointIcon,
  FileSpreadsheetIcon,
  FileUploadIcon,
  File01Icon,
  FilterHorizontalIcon,
  Flag02Icon,
  FlashIcon,
  FloppyDiskIcon,
  FuelStationIcon,
  GaugeIcon,
  GitMergeIcon,
  GridViewIcon,
  HistoryIcon,
  InboxIcon,
  InformationCircleIcon,
  Key01Icon,
  LeftToRightListNumberIcon,
  Leaf01Icon,
  Link02Icon,
  LinkSquare02Icon,
  LiveStreaming02Icon,
  Loading03Icon,
  Location01Icon,
  Login03Icon,
  Logout03Icon,
  MagicWand01Icon,
  Mail01Icon,
  MailValidation01Icon,
  MapsIcon,
  Menu01Icon,
  Message01Icon,
  MinusSignIcon,
  Money04Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  Navigation03Icon,
  Notification01Icon,
  PackageIcon,
  PaletteIcon,
  PanelRightOpenIcon,
  PencilEdit01Icon,
  PencilEdit02Icon,
  PercentIcon,
  PiggyBankIcon,
  PlayIcon,
  PlusSignIcon,
  PowerIcon,
  PowerOffIcon,
  Pulse01Icon,
  ReceiptIcon,
  ReloadIcon,
  Route01Icon,
  RulerIcon,
  ScrollTextIcon,
  Search01Icon,
  SearchAddIcon,
  SecurityCheckIcon,
  Shield01Icon,
  ShieldOffIcon,
  ShrinkIcon,
  SidebarLeftIcon,
  SmartPhone01Icon,
  SparklesIcon,
  SplitIcon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  StarIcon,
  StopIcon,
  Store02Icon,
  Sun03Icon,
  SunriseIcon,
  SunsetIcon,
  Task01Icon,
  TaskDone01Icon,
  Tick02Icon,
  TickDouble02Icon,
  TranslateIcon,
  TreeDeciduousIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  Undo02Icon,
  Undo03Icon,
  Upload01Icon,
  User03Icon,
  UserAdd01Icon,
  UserIcon,
  UserMinus01Icon,
  UserMultipleIcon,
  UserRemove01Icon,
  UserSettings01Icon,
  UnavailableIcon,
  ViewIcon,
  ViewOffSlashIcon,
  Wallet01Icon,
  WaypointsIcon,
  Wifi01Icon,
  WifiOff01Icon,
  WorkflowSquare03Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";

/**
 * Stroke weight used when a caller doesn't pass `strokeWidth`. Hugeicons are
 * drawn at 1.5; 2 matches the weight the UI was designed around, so text and
 * icons keep the same visual balance. Change it here to re-weight every icon.
 */
const DEFAULT_STROKE_WIDTH = 2;

export type IconProps = Omit<HugeiconsProps, "icon" | "altIcon" | "showAlt" | "ref">;
export type AppIcon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

/** Decorative by default: hidden from screen readers unless the caller labels it. */
function hasA11yProp(props: IconProps) {
  return Object.keys(props).some((key) => key.startsWith("aria-") || key === "role" || key === "title");
}

function createIcon(icon: IconSvgElement, displayName: string): AppIcon {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon({ strokeWidth = DEFAULT_STROKE_WIDTH, ...props }, ref) {
    return (
      <HugeiconsIcon
        ref={ref}
        icon={icon}
        strokeWidth={strokeWidth}
        aria-hidden={hasA11yProp(props) ? undefined : true}
        {...props}
      />
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

export const Activity = /* @__PURE__ */ createIcon(Pulse01Icon, "Activity");
export const AlertCircle = /* @__PURE__ */ createIcon(AlertCircleIcon, "AlertCircle");
export const AlertTriangle = /* @__PURE__ */ createIcon(Alert02Icon, "AlertTriangle");
export const ArrowDown = /* @__PURE__ */ createIcon(ArrowDown02Icon, "ArrowDown");
export const ArrowDownRight = /* @__PURE__ */ createIcon(ArrowDownRight01Icon, "ArrowDownRight");
export const ArrowLeft = /* @__PURE__ */ createIcon(ArrowLeft02Icon, "ArrowLeft");
export const ArrowLeftRight = /* @__PURE__ */ createIcon(ArrowDataTransferHorizontalIcon, "ArrowLeftRight");
export const ArrowRight = /* @__PURE__ */ createIcon(ArrowRight02Icon, "ArrowRight");
export const ArrowUp = /* @__PURE__ */ createIcon(ArrowUp02Icon, "ArrowUp");
export const ArrowUpDown = /* @__PURE__ */ createIcon(ArrowUpDownIcon, "ArrowUpDown");
export const ArrowUpRight = /* @__PURE__ */ createIcon(ArrowUpRight01Icon, "ArrowUpRight");
export const Ban = /* @__PURE__ */ createIcon(UnavailableIcon, "Ban");
export const Banknote = /* @__PURE__ */ createIcon(Money04Icon, "Banknote");
export const BarChart2 = /* @__PURE__ */ createIcon(Analytics01Icon, "BarChart2");
export const BarChart3 = /* @__PURE__ */ createIcon(ChartColumnIcon, "BarChart3");
export const Bell = /* @__PURE__ */ createIcon(Notification01Icon, "Bell");
export const Building2 = /* @__PURE__ */ createIcon(Building03Icon, "Building2");
export const Bus = /* @__PURE__ */ createIcon(Bus03Icon, "Bus");
export const Calculator = /* @__PURE__ */ createIcon(Calculator01Icon, "Calculator");
export const Calendar = /* @__PURE__ */ createIcon(Calendar04Icon, "Calendar");
export const CalendarCheck = /* @__PURE__ */ createIcon(CalendarCheck01Icon, "CalendarCheck");
export const CalendarClock = /* @__PURE__ */ createIcon(CalendarClockIcon, "CalendarClock");
export const CalendarDays = /* @__PURE__ */ createIcon(Calendar03Icon, "CalendarDays");
export const CalendarPlus = /* @__PURE__ */ createIcon(CalendarAdd01Icon, "CalendarPlus");
export const Car = /* @__PURE__ */ createIcon(Car03Icon, "Car");
export const CarFront = /* @__PURE__ */ createIcon(Car01Icon, "CarFront");
export const Check = /* @__PURE__ */ createIcon(Tick02Icon, "Check");
export const CheckCheck = /* @__PURE__ */ createIcon(TickDouble02Icon, "CheckCheck");
export const CheckCircle2 = /* @__PURE__ */ createIcon(CheckmarkCircle02Icon, "CheckCircle2");
export const ChevronDown = /* @__PURE__ */ createIcon(ArrowDown01Icon, "ChevronDown");
export const ChevronLeft = /* @__PURE__ */ createIcon(ArrowLeft01Icon, "ChevronLeft");
export const ChevronRight = /* @__PURE__ */ createIcon(ArrowRight01Icon, "ChevronRight");
export const CircleAlert = /* @__PURE__ */ createIcon(AlertCircleIcon, "CircleAlert");
export const CircleCheck = /* @__PURE__ */ createIcon(CheckmarkCircle02Icon, "CircleCheck");
export const CircleDashed = /* @__PURE__ */ createIcon(CircleDashedIcon, "CircleDashed");
export const CircleDollarSign = /* @__PURE__ */ createIcon(DollarCircleIcon, "CircleDollarSign");
export const CircleX = /* @__PURE__ */ createIcon(CancelCircleIcon, "CircleX");
export const ClipboardCheck = /* @__PURE__ */ createIcon(TaskDone01Icon, "ClipboardCheck");
export const ClipboardList = /* @__PURE__ */ createIcon(Task01Icon, "ClipboardList");
export const Clock = /* @__PURE__ */ createIcon(Clock01Icon, "Clock");
export const Clock3 = /* @__PURE__ */ createIcon(Clock01Icon, "Clock3");
export const Coins = /* @__PURE__ */ createIcon(Coins01Icon, "Coins");
export const Copy = /* @__PURE__ */ createIcon(Copy01Icon, "Copy");
export const CornerDownLeft = /* @__PURE__ */ createIcon(CornerDownLeftIcon, "CornerDownLeft");
export const CreditCard = /* @__PURE__ */ createIcon(CreditCardIcon, "CreditCard");
export const Crosshair = /* @__PURE__ */ createIcon(CrosshairIcon, "Crosshair");
export const Download = /* @__PURE__ */ createIcon(Download01Icon, "Download");
export const Droplets = /* @__PURE__ */ createIcon(DropletsIcon, "Droplets");
export const Edit = /* @__PURE__ */ createIcon(PencilEdit02Icon, "Edit");
export const ExternalLink = /* @__PURE__ */ createIcon(LinkSquare02Icon, "ExternalLink");
export const Eye = /* @__PURE__ */ createIcon(ViewIcon, "Eye");
export const EyeOff = /* @__PURE__ */ createIcon(ViewOffSlashIcon, "EyeOff");
export const FileBarChart = /* @__PURE__ */ createIcon(FileChartColumnIcon, "FileBarChart");
export const FileDown = /* @__PURE__ */ createIcon(FileDownloadIcon, "FileDown");
export const FilePlus2 = /* @__PURE__ */ createIcon(FileAddIcon, "FilePlus2");
export const FileSpreadsheet = /* @__PURE__ */ createIcon(FileSpreadsheetIcon, "FileSpreadsheet");
export const FileText = /* @__PURE__ */ createIcon(File01Icon, "FileText");
export const FileUp = /* @__PURE__ */ createIcon(FileUploadIcon, "FileUp");
export const FileWarning = /* @__PURE__ */ createIcon(FileExclamationPointIcon, "FileWarning");
export const Flag = /* @__PURE__ */ createIcon(Flag02Icon, "Flag");
export const Fuel = /* @__PURE__ */ createIcon(FuelStationIcon, "Fuel");
export const Gauge = /* @__PURE__ */ createIcon(GaugeIcon, "Gauge");
export const GitMerge = /* @__PURE__ */ createIcon(GitMergeIcon, "GitMerge");
export const GripVertical = /* @__PURE__ */ createIcon(DragDropVerticalIcon, "GripVertical");
export const History = /* @__PURE__ */ createIcon(HistoryIcon, "History");
export const Inbox = /* @__PURE__ */ createIcon(InboxIcon, "Inbox");
export const Info = /* @__PURE__ */ createIcon(InformationCircleIcon, "Info");
export const KeyRound = /* @__PURE__ */ createIcon(Key01Icon, "KeyRound");
export const Landmark = /* @__PURE__ */ createIcon(BankIcon, "Landmark");
export const Languages = /* @__PURE__ */ createIcon(TranslateIcon, "Languages");
export const LayoutDashboard = /* @__PURE__ */ createIcon(DashboardSquare02Icon, "LayoutDashboard");
export const LayoutGrid = /* @__PURE__ */ createIcon(GridViewIcon, "LayoutGrid");
export const Leaf = /* @__PURE__ */ createIcon(Leaf01Icon, "Leaf");
export const Lightbulb = /* @__PURE__ */ createIcon(BulbIcon, "Lightbulb");
export const Link2 = /* @__PURE__ */ createIcon(Link02Icon, "Link2");
export const ListOrdered = /* @__PURE__ */ createIcon(LeftToRightListNumberIcon, "ListOrdered");
export const Loader2 = /* @__PURE__ */ createIcon(Loading03Icon, "Loader2");
export const Lock = /* @__PURE__ */ createIcon(SquareLock02Icon, "Lock");
export const LockOpen = /* @__PURE__ */ createIcon(SquareUnlock02Icon, "LockOpen");
export const LogIn = /* @__PURE__ */ createIcon(Login03Icon, "LogIn");
export const LogOut = /* @__PURE__ */ createIcon(Logout03Icon, "LogOut");
export const Mail = /* @__PURE__ */ createIcon(Mail01Icon, "Mail");
export const MailCheck = /* @__PURE__ */ createIcon(MailValidation01Icon, "MailCheck");
export const MapIcon = /* @__PURE__ */ createIcon(MapsIcon, "MapIcon");
export const MapPin = /* @__PURE__ */ createIcon(Location01Icon, "MapPin");
export const Maximize2 = /* @__PURE__ */ createIcon(ArrowExpand01Icon, "Maximize2");
export const Menu = /* @__PURE__ */ createIcon(Menu01Icon, "Menu");
export const MessageSquare = /* @__PURE__ */ createIcon(Message01Icon, "MessageSquare");
export const Minimize2 = /* @__PURE__ */ createIcon(ArrowShrink02Icon, "Minimize2");
export const Minus = /* @__PURE__ */ createIcon(MinusSignIcon, "Minus");
export const Moon = /* @__PURE__ */ createIcon(Moon02Icon, "Moon");
export const MoreHorizontal = /* @__PURE__ */ createIcon(MoreHorizontalIcon, "MoreHorizontal");
export const Navigation = /* @__PURE__ */ createIcon(Navigation03Icon, "Navigation");
export const Package = /* @__PURE__ */ createIcon(PackageIcon, "Package");
export const Palette = /* @__PURE__ */ createIcon(PaletteIcon, "Palette");
export const PanelLeft = /* @__PURE__ */ createIcon(SidebarLeftIcon, "PanelLeft");
export const PanelRightOpen = /* @__PURE__ */ createIcon(PanelRightOpenIcon, "PanelRightOpen");
export const Pencil = /* @__PURE__ */ createIcon(PencilEdit01Icon, "Pencil");
export const Percent = /* @__PURE__ */ createIcon(PercentIcon, "Percent");
export const Phone = /* @__PURE__ */ createIcon(Call02Icon, "Phone");
export const PiggyBank = /* @__PURE__ */ createIcon(PiggyBankIcon, "PiggyBank");
export const Play = /* @__PURE__ */ createIcon(PlayIcon, "Play");
export const Plus = /* @__PURE__ */ createIcon(PlusSignIcon, "Plus");
export const Power = /* @__PURE__ */ createIcon(PowerIcon, "Power");
export const PowerOff = /* @__PURE__ */ createIcon(PowerOffIcon, "PowerOff");
export const Radio = /* @__PURE__ */ createIcon(LiveStreaming02Icon, "Radio");
export const Receipt = /* @__PURE__ */ createIcon(ReceiptIcon, "Receipt");
export const RefreshCw = /* @__PURE__ */ createIcon(ReloadIcon, "RefreshCw");
export const RotateCcw = /* @__PURE__ */ createIcon(Undo02Icon, "RotateCcw");
export const RouteIcon = /* @__PURE__ */ createIcon(Route01Icon, "RouteIcon");
export const Ruler = /* @__PURE__ */ createIcon(RulerIcon, "Ruler");
export const Save = /* @__PURE__ */ createIcon(FloppyDiskIcon, "Save");
export const ScrollText = /* @__PURE__ */ createIcon(ScrollTextIcon, "ScrollText");
export const Search = /* @__PURE__ */ createIcon(Search01Icon, "Search");
export const Settings2 = /* @__PURE__ */ createIcon(FilterHorizontalIcon, "Settings2");
export const Shield = /* @__PURE__ */ createIcon(Shield01Icon, "Shield");
export const ShieldCheck = /* @__PURE__ */ createIcon(SecurityCheckIcon, "ShieldCheck");
export const ShieldOff = /* @__PURE__ */ createIcon(ShieldOffIcon, "ShieldOff");
export const Shrink = /* @__PURE__ */ createIcon(ShrinkIcon, "Shrink");
export const Smartphone = /* @__PURE__ */ createIcon(SmartPhone01Icon, "Smartphone");
export const Sparkles = /* @__PURE__ */ createIcon(SparklesIcon, "Sparkles");
export const Split = /* @__PURE__ */ createIcon(SplitIcon, "Split");
export const Square = /* @__PURE__ */ createIcon(StopIcon, "Square");
export const Star = /* @__PURE__ */ createIcon(StarIcon, "Star");
export const Store = /* @__PURE__ */ createIcon(Store02Icon, "Store");
export const Sun = /* @__PURE__ */ createIcon(Sun03Icon, "Sun");
export const Sunrise = /* @__PURE__ */ createIcon(SunriseIcon, "Sunrise");
export const Sunset = /* @__PURE__ */ createIcon(SunsetIcon, "Sunset");
export const Trash = /* @__PURE__ */ createIcon(Delete01Icon, "Trash");
export const Trash2 = /* @__PURE__ */ createIcon(Delete02Icon, "Trash2");
export const TreeDeciduous = /* @__PURE__ */ createIcon(TreeDeciduousIcon, "TreeDeciduous");
export const TrendingDown = /* @__PURE__ */ createIcon(TrendingDownIcon, "TrendingDown");
export const TrendingUp = /* @__PURE__ */ createIcon(TrendingUpIcon, "TrendingUp");
export const TriangleAlert = /* @__PURE__ */ createIcon(Alert02Icon, "TriangleAlert");
export const Truck = /* @__PURE__ */ createIcon(DeliveryTruck01Icon, "Truck");
export const Undo2 = /* @__PURE__ */ createIcon(Undo03Icon, "Undo2");
export const Upload = /* @__PURE__ */ createIcon(Upload01Icon, "Upload");
export const User = /* @__PURE__ */ createIcon(UserIcon, "User");
export const UserCog = /* @__PURE__ */ createIcon(UserSettings01Icon, "UserCog");
export const UserMinus = /* @__PURE__ */ createIcon(UserMinus01Icon, "UserMinus");
export const UserPlus = /* @__PURE__ */ createIcon(UserAdd01Icon, "UserPlus");
export const UserRound = /* @__PURE__ */ createIcon(User03Icon, "UserRound");
export const UserX = /* @__PURE__ */ createIcon(UserRemove01Icon, "UserX");
export const Users = /* @__PURE__ */ createIcon(UserMultipleIcon, "Users");
export const Wallet = /* @__PURE__ */ createIcon(Wallet01Icon, "Wallet");
export const Wand2 = /* @__PURE__ */ createIcon(MagicWand01Icon, "Wand2");
export const Waypoints = /* @__PURE__ */ createIcon(WaypointsIcon, "Waypoints");
export const Wifi = /* @__PURE__ */ createIcon(Wifi01Icon, "Wifi");
export const WifiOff = /* @__PURE__ */ createIcon(WifiOff01Icon, "WifiOff");
export const Workflow = /* @__PURE__ */ createIcon(WorkflowSquare03Icon, "Workflow");
export const Wrench = /* @__PURE__ */ createIcon(Wrench01Icon, "Wrench");
export const X = /* @__PURE__ */ createIcon(Cancel01Icon, "X");
export const XCircle = /* @__PURE__ */ createIcon(CancelCircleIcon, "XCircle");
export const Zap = /* @__PURE__ */ createIcon(FlashIcon, "Zap");
export const ZoomIn = /* @__PURE__ */ createIcon(SearchAddIcon, "ZoomIn");
