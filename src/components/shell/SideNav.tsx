"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderInput,
  Inbox,
  LayoutTemplate,
  LogOut,
  Moon,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Repeat,
  Search,
  Settings,
  Target,
  Shield,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";
import Popover, { PopoverItem } from "@/components/ui/Popover";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ViewKind } from "@/hooks/useDashboardView";
import type { Folder as FolderType, List as ListType } from "@/lib/types";

export interface NavCounts {
  today: number;
  week: number;
  all: number;
  overdue: number;
  running: number;
  /** Open tasks per list, for the number on the right of a list row. */
  lists: Record<string, number>;
}

interface SideNavProps {
  view: ViewKind;
  activeListId: string | null;
  activeFolderId: string | null;
  counts: NavCounts;
  lists: ListType[];
  folders: FolderType[];
  email?: string;

  onSelectView: (kind: ViewKind) => void;
  onSelectList: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onOpenSearch: () => void;
  onSignOut: () => void;

  onCreateList: (name: string) => void;
  onRenameList: (id: string, name: string) => void;
  onSetListColor: (id: string, color: string | null) => void;
  onMoveListToFolder: (id: string, folderId: string | null) => void;
  onDeleteList: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  /** New order of every list, ungrouped first, then folder by folder. */
  onReorderLists: (lists: ListType[]) => void;

  /** Mobile renders the same nav inside a sheet, where collapsing makes no sense. */
  collapsible?: boolean;
  onNavigated?: () => void;
  /** Into the focus view. The full app is what this navigation is for. */
  onEnterFocus?: () => void;
}

const VIEW_ROWS: { kind: ViewKind; label: string; icon: React.ElementType; count: keyof NavCounts }[] = [
  { kind: "today", label: "Today", icon: Sun, count: "today" },
  { kind: "week", label: "This Week", icon: CalendarDays, count: "week" },
  { kind: "all", label: "All Tasks", icon: Inbox, count: "all" },
  { kind: "overdue", label: "Overdue", icon: AlertCircle, count: "overdue" },
  { kind: "running", label: "Running", icon: Activity, count: "running" },
];

const MORE_ROWS: { kind: ViewKind; label: string; icon: React.ElementType }[] = [
  { kind: "events", label: "Projects", icon: CalendarRange },
  { kind: "habits", label: "Habits", icon: Repeat },
  { kind: "journal", label: "Journal", icon: BookOpen },
  { kind: "templates", label: "Templates", icon: LayoutTemplate },
  { kind: "rules", label: "Principles", icon: Shield },
  { kind: "time", label: "Time Tracking", icon: Clock },
];

const LIST_COLORS = ["#5B8DEF", "#3DBE7A", "#E7A33A", "#E8699F", "#8A8AF0", "#9AA3B2"];

export default function SideNav({
  view,
  activeListId,
  activeFolderId,
  counts,
  lists,
  folders,
  email,
  onSelectView,
  onSelectList,
  onSelectFolder,
  onOpenSearch,
  onSignOut,
  onCreateList,
  onRenameList,
  onSetListColor,
  onMoveListToFolder,
  onDeleteList,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderLists,
  collapsible = true,
  onNavigated,
  onEnterFocus,
}: SideNavProps) {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  // Under 1280 px the column is the 56 px rail whatever the stored state says
  const [narrow, setNarrow] = useState(false);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<null | "list" | "folder">(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    if (!collapsible) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 1279px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [collapsible]);

  useEffect(() => {
    if (!collapsible) return;
    try {
      setCollapsed(localStorage.getItem("navCollapsed") === "1");
      const stored = localStorage.getItem("navOpenFolders");
      if (stored) setOpenFolders(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }
  }, [collapsible]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("navCollapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("navOpenFolders", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const go = useCallback((run: () => void) => { run(); onNavigated?.(); }, [onNavigated]);

  // A drag starts only after 8 px, so a plain click still selects the list
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = lists.findIndex((l) => l.id === String(active.id));
      const to = lists.findIndex((l) => l.id === String(over.id));
      if (from === -1 || to === -1) return;
      // Reordering never changes which folder a list is in; that is what the
      // "Move to folder" entry in the row menu is for.
      if (lists[from].folder_id !== lists[to].folder_id) return;
      onReorderLists(arrayMove(lists, from, to));
    },
    [lists, onReorderLists]
  );

  const iconsOnly = collapsible && (collapsed || narrow);
  const ungrouped = lists.filter((l) => !l.folder_id);

  return (
    <>
      <div className="app-col-head" style={{ paddingInline: iconsOnly ? 8 : 16 }}>
        {!iconsOnly && (
          <span className="flex-1 min-w-0 truncate text-sm font-semibold text-text">todos</span>
        )}
        <button onClick={onOpenSearch} className="icon-btn flex-none" aria-label={t("Search")} title={`${t("Search")}  ⌘K`}>
          <Search size={18} />
        </button>
        {collapsible && (
          <button
            onClick={toggleCollapsed}
            className="icon-btn flex-none nav-collapse-btn"
            aria-label={collapsed ? t("Expand navigation") : t("Collapse navigation")}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>

      <nav className="app-col-body px-2 pb-2" aria-label={t("Views")}>
        {onEnterFocus && (
          <NavRow
            icon={<Target size={18} />}
            label={t("Focus")}
            iconsOnly={iconsOnly}
            onClick={() => go(onEnterFocus)}
          />
        )}
        <SectionTitle hidden={iconsOnly} first={!onEnterFocus}>{t("Views")}</SectionTitle>
        {VIEW_ROWS.map(({ kind, label, icon: Icon, count }) => {
          const n = counts[count] as number;
          if (kind === "overdue" && n === 0 && view !== "overdue") return null;
          return (
            <NavRow
              key={kind}
              icon={<Icon size={18} />}
              label={t(label)}
              count={n}
              active={view === kind && !activeListId && !activeFolderId}
              iconsOnly={iconsOnly}
              onClick={() => go(() => onSelectView(kind))}
            />
          );
        })}

        <SectionTitle hidden={iconsOnly}>{t("Lists")}</SectionTitle>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={lists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        {ungrouped.map((list) => (
          <ListRow
            key={list.id}
            list={list}
            folders={folders}
            count={counts.lists[list.id] ?? 0}
            active={activeListId === list.id}
            iconsOnly={iconsOnly}
            renaming={renamingId === list.id}
            onStartRename={() => setRenamingId(list.id)}
            onEndRename={() => setRenamingId(null)}
            onSelect={() => go(() => onSelectList(list.id))}
            onRename={onRenameList}
            onSetColor={onSetListColor}
            onMoveToFolder={onMoveListToFolder}
            onDelete={onDeleteList}
          />
        ))}

        {folders.map((folder) => {
          const open = openFolders.has(folder.id);
          const inFolder = lists.filter((l) => l.folder_id === folder.id);
          return (
            <div key={folder.id}>
              <FolderRow
                folder={folder}
                open={open}
                active={activeFolderId === folder.id}
                iconsOnly={iconsOnly}
                renaming={renamingId === folder.id}
                onStartRename={() => setRenamingId(folder.id)}
                onEndRename={() => setRenamingId(null)}
                onToggle={() => toggleFolder(folder.id)}
                onSelect={() => go(() => onSelectFolder(folder.id))}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
              />
              {open && !iconsOnly && (
                <div className="pl-[22px]">
                  {inFolder.map((list) => (
                    <ListRow
                      key={list.id}
                      list={list}
                      folders={folders}
                      count={counts.lists[list.id] ?? 0}
                      active={activeListId === list.id}
                      iconsOnly={false}
                      renaming={renamingId === list.id}
                      onStartRename={() => setRenamingId(list.id)}
                      onEndRename={() => setRenamingId(null)}
                      onSelect={() => go(() => onSelectList(list.id))}
                      onRename={onRenameList}
                      onSetColor={onSetListColor}
                      onMoveToFolder={onMoveListToFolder}
                      onDelete={onDeleteList}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        </SortableContext>
        </DndContext>

        {iconsOnly ? (
          /* The rail has no room for a field, so the same two actions open
             in a popover instead of turning the row into an input. */
          <Popover
            label={t("New list")}
            trigger={(p) => (
              <button
                ref={p.ref as (el: HTMLButtonElement | null) => void}
                onClick={p.onClick}
                aria-expanded={p["aria-expanded"]}
                className="nav-row w-full justify-center text-text-faint"
                style={{ paddingInline: 0 }}
                aria-label={t("New list")}
                title={t("New list")}
              >
                <Plus size={18} className="flex-none" />
              </button>
            )}
          >
            {(close) => (
              <div className="w-[220px]">
                <InlineInput
                  icon={<Plus size={18} className="flex-none text-text-faint" />}
                  placeholder={t("List name")}
                  onSubmit={(name) => { onCreateList(name); close(); }}
                  onCancel={close}
                />
                <InlineInput
                  icon={<Folder size={18} className="flex-none text-text-faint" />}
                  placeholder={t("Folder name")}
                  onSubmit={(name) => { onCreateFolder(name); close(); }}
                  onCancel={close}
                />
              </div>
            )}
          </Popover>
        ) : creating === null ? (
          <div className="flex items-center">
            <button onClick={() => setCreating("list")} className="nav-row flex-1 text-text-faint">
              <Plus size={18} className="flex-none" />
              <span className="flex-1 text-left truncate">{t("New list")}</span>
            </button>
            <button
              onClick={() => setCreating("folder")}
              className="icon-btn flex-none w-8 h-8"
              aria-label={t("New folder")}
              title={t("New folder")}
            >
              <Folder size={16} />
            </button>
          </div>
        ) : (
          <InlineInput
            icon={creating === "folder" ? <Folder size={18} className="flex-none text-text-faint" /> : <Plus size={18} className="flex-none text-text-faint" />}
            placeholder={creating === "folder" ? t("Folder name") : t("List name")}
            onSubmit={(name) => {
              if (creating === "folder") onCreateFolder(name); else onCreateList(name);
              setCreating(null);
            }}
            onCancel={() => setCreating(null)}
          />
        )}

        <SectionTitle hidden={iconsOnly}>{t("More")}</SectionTitle>
        {MORE_ROWS.map(({ kind, label, icon: Icon }) => (
          <NavRow
            key={kind}
            icon={<Icon size={18} />}
            label={t(label)}
            active={view === kind}
            iconsOnly={iconsOnly}
            onClick={() => go(() => onSelectView(kind))}
          />
        ))}
      </nav>

      <div
        className="flex-none flex items-center gap-1 px-2 py-2 border-t border-border"
        style={{ flexDirection: iconsOnly ? "column" : "row" }}
      >
        <Link href="/settings" className="icon-btn flex-none" aria-label={t("Settings")} title={t("Settings")}>
          <Settings size={18} />
        </Link>
        <button
          onClick={toggleTheme}
          className="icon-btn flex-none"
          aria-label={theme === "dark" ? t("Light") : t("Dark")}
          title={theme === "dark" ? t("Light") : t("Dark")}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {!iconsOnly && <span className="flex-1" />}
        <Popover
          align="end"
          label={t("Account")}
          trigger={(p) => (
            <button
              ref={p.ref as (el: HTMLButtonElement | null) => void}
              onClick={p.onClick}
              aria-expanded={p["aria-expanded"]}
              className="flex-none w-8 h-8 rounded-full surface-2 text-xs font-semibold text-text-muted flex items-center justify-center"
              aria-label={t("Account")}
              title={email}
            >
              {initials(email)}
            </button>
          )}
        >
          {(close) => (
            <div className="min-w-[180px]">
              {email && <p className="px-2 py-1.5 text-xs text-text-faint truncate">{email}</p>}
              <PopoverItem icon={<LogOut size={16} />} onClick={() => { close(); onSignOut(); }}>
                {t("Sign out")}
              </PopoverItem>
            </div>
          )}
        </Popover>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function initials(email?: string): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function SectionTitle({ children, hidden, first }: { children: React.ReactNode; hidden?: boolean; first?: boolean }) {
  if (hidden) return <div className={first ? "h-1" : "h-4"} />;
  return (
    <p className="section-title px-2" style={{ marginTop: first ? 8 : 24, marginBottom: 4 }}>
      {children}
    </p>
  );
}

function NavRow({
  icon,
  label,
  count,
  shortcut,
  active = false,
  iconsOnly = false,
  onClick,
  onContextMenu,
  trailing,
  rowRef,
  rowStyle,
  dragProps,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  shortcut?: string;
  active?: boolean;
  iconsOnly?: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  trailing?: React.ReactNode;
  rowRef?: (el: HTMLElement | null) => void;
  rowStyle?: React.CSSProperties;
  dragProps?: Record<string, unknown>;
}) {
  return (
    <div ref={rowRef} style={rowStyle} className="group relative flex items-center">
      <button
        {...dragProps}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`nav-row flex-1 touch-none ${active ? "is-active" : ""}`}
        style={{ justifyContent: iconsOnly ? "center" : undefined, paddingInline: iconsOnly ? 0 : undefined }}
        title={iconsOnly ? label : undefined}
        aria-current={active ? "page" : undefined}
      >
        <span className="flex-none nav-row-icon">{icon}</span>
        {!iconsOnly && <span className="flex-1 text-left truncate">{label}</span>}
        {!iconsOnly && shortcut && <span className="text-xs text-text-faint">{shortcut}</span>}
        {!iconsOnly && count !== undefined && count > 0 && (
          <span className="text-[13px] text-text-faint tabular-nums">{count}</span>
        )}
      </button>
      {!iconsOnly && trailing}
    </div>
  );
}

function ListRow({
  list,
  folders,
  count,
  active,
  iconsOnly,
  renaming,
  onStartRename,
  onEndRename,
  onSelect,
  onRename,
  onSetColor,
  onMoveToFolder,
  onDelete,
}: {
  list: ListType;
  folders: FolderType[];
  count: number;
  active: boolean;
  iconsOnly: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onEndRename: () => void;
  onSelect: () => void;
  onRename: (id: string, name: string) => void;
  onSetColor: (id: string, color: string | null) => void;
  onMoveToFolder: (id: string, folderId: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id });

  if (renaming) {
    return (
      <InlineInput
        icon={<Dot color={list.color} />}
        defaultValue={list.name}
        placeholder={t("List name")}
        onSubmit={(name) => { onRename(list.id, name); onEndRename(); }}
        onCancel={onEndRename}
      />
    );
  }

  return (
    <NavRow
      rowRef={setNodeRef}
      rowStyle={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      dragProps={{ ...attributes, ...listeners }}
      icon={<Dot color={list.color} />}
      label={list.name}
      count={count}
      active={active}
      iconsOnly={iconsOnly}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
      trailing={
        <Popover
          align="end"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          label={t("List options")}
          trigger={(p) => (
            <button
              ref={p.ref as (el: HTMLButtonElement | null) => void}
              onClick={p.onClick}
              aria-expanded={p["aria-expanded"]}
              className="icon-btn flex-none w-8 h-8 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
              aria-label={t("List options")}
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        >
          {(close) => (
            <div className="min-w-[200px]">
              <PopoverItem icon={<Pencil size={16} />} onClick={() => { close(); onStartRename(); }}>
                {t("Rename")}
              </PopoverItem>
              <div className="flex items-center gap-2 h-8 px-2">
                <Palette size={16} className="text-text-muted flex-none" />
                <div className="flex items-center gap-1.5">
                  {LIST_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { onSetColor(list.id, c); close(); }}
                      className="w-4 h-4 rounded-full"
                      style={{ background: c, outline: list.color === c ? "2px solid var(--accent)" : "none", outlineOffset: 1 }}
                      aria-label={c}
                    />
                  ))}
                  <button
                    onClick={() => { onSetColor(list.id, null); close(); }}
                    className="w-4 h-4 rounded-full border border-border-strong flex items-center justify-center"
                    aria-label={t("Remove color")}
                  >
                    <X size={9} className="text-text-faint" />
                  </button>
                </div>
              </div>
              {folders.length > 0 && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <p className="px-2 pb-1 text-xs text-text-faint">{t("Move to folder")}</p>
                  {list.folder_id && (
                    <PopoverItem icon={<FolderInput size={16} />} onClick={() => { onMoveToFolder(list.id, null); close(); }}>
                      {t("No folder")}
                    </PopoverItem>
                  )}
                  {folders.filter((f) => f.id !== list.folder_id).map((f) => (
                    <PopoverItem key={f.id} icon={<Folder size={16} />} onClick={() => { onMoveToFolder(list.id, f.id); close(); }}>
                      {f.name}
                    </PopoverItem>
                  ))}
                </>
              )}
              <div className="my-1 h-px bg-border" />
              <PopoverItem icon={<Trash2 size={16} />} danger onClick={() => { close(); onDelete(list.id); }}>
                {t("Delete")}
              </PopoverItem>
            </div>
          )}
        </Popover>
      }
    />
  );
}

function FolderRow({
  folder,
  open,
  active,
  iconsOnly,
  renaming,
  onStartRename,
  onEndRename,
  onToggle,
  onSelect,
  onRename,
  onDelete,
}: {
  folder: FolderType;
  open: boolean;
  active: boolean;
  iconsOnly: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onEndRename: () => void;
  onToggle: () => void;
  onSelect: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  if (renaming) {
    return (
      <InlineInput
        icon={<Folder size={18} className="flex-none text-text-muted" />}
        defaultValue={folder.name}
        placeholder={t("Folder name")}
        onSubmit={(name) => { onRename(folder.id, name); onEndRename(); }}
        onCancel={onEndRename}
      />
    );
  }

  return (
    <div className="group relative flex items-center">
      {!iconsOnly && (
        <button
          onClick={onToggle}
          className="icon-btn flex-none w-6 h-8"
          aria-label={open ? t("Collapse") : t("Expand")}
          aria-expanded={open}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      )}
      <button
        onClick={onSelect}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
        className={`nav-row flex-1 ${active ? "is-active" : ""}`}
        style={{ paddingLeft: iconsOnly ? 0 : 4, justifyContent: iconsOnly ? "center" : undefined }}
        title={iconsOnly ? folder.name : undefined}
      >
        <span className="flex-none nav-row-icon"><Folder size={18} /></span>
        {!iconsOnly && <span className="flex-1 text-left truncate">{folder.name}</span>}
      </button>
      {!iconsOnly && (
        <Popover
          align="end"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          label={t("Folder options")}
          trigger={(p) => (
            <button
              ref={p.ref as (el: HTMLButtonElement | null) => void}
              onClick={p.onClick}
              aria-expanded={p["aria-expanded"]}
              className="icon-btn flex-none w-8 h-8 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
              aria-label={t("Folder options")}
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        >
          {(close) => (
            <div className="min-w-[180px]">
              <PopoverItem icon={<Pencil size={16} />} onClick={() => { close(); onStartRename(); }}>
                {t("Rename")}
              </PopoverItem>
              <div className="my-1 h-px bg-border" />
              <PopoverItem icon={<Trash2 size={16} />} danger onClick={() => { close(); onDelete(folder.id); }}>
                {t("Delete")}
              </PopoverItem>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}

function Dot({ color }: { color?: string | null }) {
  return (
    <span
      className="w-2 h-2 rounded-full block"
      style={{ background: color ?? "var(--text-faint)" }}
    />
  );
}

/** A nav row that turns into a field: Enter saves, Esc gives up. */
function InlineInput({
  icon,
  defaultValue = "",
  placeholder,
  onSubmit,
  onCancel,
}: {
  icon: React.ReactNode;
  defaultValue?: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => { ref.current?.select(); }, []);

  function submit() {
    const name = value.trim();
    if (name === "") { onCancel(); return; }
    onSubmit(name);
  }

  return (
    <div className="nav-row">
      <span className="flex-none nav-row-icon">{icon}</span>
      <input
        ref={ref}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={submit}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[13px] text-text placeholder:text-text-faint focus:outline-none"
      />
      <button onMouseDown={(e) => e.preventDefault()} onClick={submit} className="icon-btn w-6 h-6 flex-none" aria-label={t("Save")}>
        <Check size={14} />
      </button>
    </div>
  );
}
