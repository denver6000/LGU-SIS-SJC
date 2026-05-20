"use client";

import {
  ClipboardList,
  FileDown,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Repeat2,
  SlidersHorizontal,
  Trash2,
  UserRoundPlus,
  X
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth-provider";

type Student = {
  student_id: string;
  full_name: string;
  school_address?: string;
  school_course?: string;
  year_level?: string;
  batch?: string;
  phone_number?: string;
  status?: string;
  claimed?: boolean;
  renewed?: boolean;
  payrolled?: boolean;
  created_at?: string;
  claimed_at?: string;
};

type ViewName = "dashboard" | "register" | "renewal" | "records" | "payouts" | "import" | "setup" | "exports" | "trash";
type Column<T> = {
  key: string;
  header: string;
  width: string;
  render: (row: T) => React.ReactNode;
};

const navItems: Array<{ view: ViewName; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "register", label: "Student Registry", icon: UserRoundPlus },
  { view: "renewal", label: "Renewal Tracking", icon: Repeat2 },
  { view: "records", label: "Scholarship Listing", icon: ClipboardList },
  { view: "payouts", label: "Payout Records", icon: ReceiptText },
  { view: "import", label: "Scholarship Import", icon: FileUp },
  { view: "setup", label: "School / Course Setup", icon: SlidersHorizontal },
  { view: "exports", label: "Payroll & Exports", icon: FileDown },
  { view: "trash", label: "Trash", icon: Trash2 }
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SJ";
}

export function AppShell() {
  const { user, signOutUser } = useAuth();
  const [activeView, setActiveView] = useState<ViewName>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [trash, setTrash] = useState<Student[]>([]);
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    Promise.all([
      fetch("/data/student_data.seed.json").then((response) => response.json()).catch(() => []),
      fetch("/data/trash_data.seed.json").then((response) => response.json()).catch(() => [])
    ]).then(([studentRows, trashRows]) => {
      setStudents(studentRows);
      setTrash(trashRows);
    });
  }, []);

  useEffect(() => {
    setSelectedPayrollIds((current) => {
      const validIds = new Set(students.map((student) => student.student_id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [students]);

  function navigate(view: ViewName) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-leading">
          <button className="nav-toggle" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="brand">
            <div className="brand-mark">SJ</div>
            <div>
              <p>San Jose City Educational Assistance</p>
              <h1>Student Information System</h1>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <span className="signed-in-user">{user?.name} • {user?.role}</span>
        </div>
      </header>

      {sidebarOpen ? <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="layout" data-sidebar={sidebarOpen ? "open" : "closed"}>
        <aside className={`app-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Primary routes and actions">
          <div className="sidebar-shell">
            <div className="sidebar-profile">
              <div className="profile-avatar">{initials(user?.name || user?.email || "SJ")}</div>
              <div className="profile-copy">
                <strong>{user?.name || "Signed In User"}</strong>
                <span>{user?.role || "User"}</span>
                <span>{user?.email}</span>
              </div>
              <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="sidebar-toolbar">
              <button type="button" className="sidebar-utility" onClick={signOutUser}>
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>

            <nav className="action-nav" aria-label="Primary actions">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    className={activeView === item.view ? "active" : ""}
                    onClick={() => navigate(item.view)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                    <strong className="action-count">{countForView(item.view, students, trash)}</strong>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="content">
          <ViewContent
            view={activeView}
            students={students}
            trash={trash}
            selectedPayrollIds={selectedPayrollIds}
            setSelectedPayrollIds={setSelectedPayrollIds}
          />
        </main>
      </div>
    </>
  );
}

function countForView(view: ViewName, students: Student[], trash: Student[]) {
  if (view === "trash") return trash.length;
  if (view === "exports" || view === "payouts" || view === "renewal") return 0;
  return students.length;
}

function ViewContent({
  view,
  students,
  trash,
  selectedPayrollIds,
  setSelectedPayrollIds
}: {
  view: ViewName;
  students: Student[];
  trash: Student[];
  selectedPayrollIds: Set<string>;
  setSelectedPayrollIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const studentColumns = useMemo<Column<Student>[]>(() => [
    { key: "id", header: "ID", width: "120px", render: (student) => student.student_id },
    {
      key: "name",
      header: "Name",
      width: "260px",
      render: (student) => (
        <>
          <strong>{student.full_name}</strong>
          <span>{student.phone_number}</span>
        </>
      )
    },
    { key: "school", header: "School", width: "240px", render: (student) => student.school_address },
    { key: "course", header: "Course", width: "220px", render: (student) => student.school_course },
    { key: "year", header: "Year", width: "80px", render: (student) => student.year_level },
    { key: "batch", header: "Batch", width: "90px", render: (student) => student.batch },
    { key: "status", header: "Status", width: "160px", render: (student) => student.status || completionStatus(student) }
  ], []);

  const renewalRows = useMemo(() => students.filter((student) => student.claimed), [students]);
  const payrollRows = students;
  const payoutRows = useMemo(() => students.filter((student) => student.claimed || student.payrolled), [students]);

  function togglePayrollSelection(student: Student, isChecked: boolean) {
    setSelectedPayrollIds((current) => {
      const next = new Set(current);
      if (isChecked) {
        if (next.size >= 15 && !next.has(student.student_id)) return current;
        next.add(student.student_id);
      } else {
        next.delete(student.student_id);
      }
      return next;
    });
  }

  function selectAllPayrollRows() {
    setSelectedPayrollIds((current) => {
      const next = new Set(current);
      for (const student of payrollRows) {
        if (next.size >= 15) break;
        next.add(student.student_id);
      }
      return next;
    });
  }

  if (view === "dashboard") {
    return (
      <section className="view">
        <div className="dashboard-header">
          <p className="eyebrow">Dashboard</p>
          <h2>Student Information System</h2>
        </div>
        <div className="stats-grid">
          <Stat label="Total Scholars" value={students.length} note="Active scholars in the registry" />
          <Stat label="Pending Renewals" value={renewalRows.filter((student) => !student.renewed).length} note="Scholarship renewals awaiting review" />
          <Stat label="Approved Scholars" value={students.filter((student) => student.claimed).length} note="Students approved this cycle" />
          <Stat label="Trash Records" value={trash.length} note="Deleted or archived records" />
        </div>
      </section>
    );
  }

  if (view === "records") {
    return (
      <section className="view">
        <div className="section-header">
          <div>
            <p className="eyebrow">Scholarship Listing</p>
            <h2>Student Records</h2>
          </div>
        </div>
        <VirtualTable columns={studentColumns} rows={students} getRowKey={(student) => student.student_id} />
      </section>
    );
  }

  if (view === "renewal") {
    return (
      <section className="view">
        <div className="section-header">
          <div>
            <p className="eyebrow">Renewal Tracking</p>
            <h2>Review Prior Claimants</h2>
          </div>
        </div>
        <VirtualTable
          columns={[
            ...studentColumns,
            { key: "renewed", header: "Renewal Tracked", width: "160px", render: (student) => student.renewed ? "Yes" : "No" }
          ]}
          rows={renewalRows}
          getRowKey={(student) => student.student_id}
        />
      </section>
    );
  }

  if (view === "exports") {
    return (
      <section className="view">
        <div className="section-header">
          <div>
            <p className="eyebrow">Payroll & Exports</p>
            <h2>Export Records</h2>
          </div>
        </div>
        <div className="panel payroll-control-panel">
          <p className="selection-summary">{selectedPayrollIds.size} of 15 students selected.</p>
          <div className="actions">
            <button type="button" className="primary">Export Payroll Files</button>
            <button type="button" onClick={selectAllPayrollRows}>Select All Filtered</button>
            <button type="button" onClick={() => setSelectedPayrollIds(new Set())}>Clear Selection</button>
          </div>
        </div>
        <VirtualTable
          columns={[
            {
              key: "select",
              header: "Select",
              width: "84px",
              render: (student) => (
                <input
                  type="checkbox"
                  aria-label={`Select ${student.full_name} for payroll`}
                  checked={selectedPayrollIds.has(student.student_id)}
                  onChange={(event) => togglePayrollSelection(student, event.currentTarget.checked)}
                />
              )
            },
            ...studentColumns,
            { key: "claimed", header: "Prior Payout", width: "140px", render: (student) => student.claimed ? "Yes" : "No" },
            { key: "payrolled", header: "Payroll Prepared", width: "170px", render: (student) => student.payrolled ? "Yes" : "No" }
          ]}
          rows={payrollRows}
          getRowKey={(student) => student.student_id}
        />
      </section>
    );
  }

  if (view === "payouts") {
    return (
      <section className="view">
        <div className="section-header">
          <div>
            <p className="eyebrow">Payout History</p>
            <h2>Payout Records</h2>
          </div>
        </div>
        <VirtualTable
          columns={[
            { key: "date", header: "Date", width: "180px", render: (student) => student.claimed_at || student.created_at || "" },
            { key: "student", header: "Student", width: "260px", render: (student) => <strong>{student.full_name}</strong> },
            { key: "batch", header: "Batch", width: "90px", render: (student) => student.batch },
            { key: "type", header: "Type", width: "160px", render: (student) => student.payrolled ? "Payroll Prepared" : "Subsidy Claim" },
            { key: "status", header: "Status", width: "140px", render: () => "Recorded" }
          ]}
          rows={payoutRows}
          getRowKey={(student) => student.student_id}
        />
      </section>
    );
  }

  if (view === "trash") {
    return (
      <section className="view">
        <div className="section-header">
          <div>
            <p className="eyebrow">Deleted Records</p>
            <h2>Trash</h2>
          </div>
        </div>
        <VirtualTable columns={studentColumns} rows={trash} getRowKey={(student) => student.student_id} />
      </section>
    );
  }

  return (
    <section className="view">
      <div className="section-header">
        <div>
          <p className="eyebrow">{navItems.find((item) => item.view === view)?.label}</p>
          <h2>{navItems.find((item) => item.view === view)?.label}</h2>
        </div>
      </div>
      <div className="panel">
        <p>This Next.js React view is ready for the next migration pass from the legacy static app.</p>
      </div>
    </section>
  );
}

function completionStatus(student: Student) {
  const documentFields = [
    "certificate_of_residency",
    "pagpapatunay_form",
    "picture_of_the_house",
    "good_moral_certificate",
    "original_certificate_of_grades",
    "proof_of_enrollment",
    "school_id"
  ] as const;
  const completed = documentFields.filter((field) => Boolean(student[field as keyof Student])).length;
  return completed === documentFields.length ? "Complete" : `Incomplete (${completed}/${documentFields.length})`;
}

function VirtualTable<T>({
  columns,
  rows,
  getRowKey
}: {
  columns: Array<Column<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10
  });
  const gridTemplateColumns = columns.map((column) => column.width).join(" ");
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="virtual-table-shell">
      <div className="virtual-table-header" style={{ gridTemplateColumns }}>
        {columns.map((column) => (
          <div key={column.key} className="virtual-table-th">{column.header}</div>
        ))}
      </div>
      <div ref={scrollRef} className="virtual-table-scroll">
        <div className="virtual-table-spacer" style={{ height: rowVirtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={getRowKey(row)}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className="virtual-table-row"
                style={{
                  gridTemplateColumns,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {columns.map((column) => (
                  <div key={column.key} className="virtual-table-td">{column.render(row)}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="stat-card card">
      <p className="stat-label">{label}</p>
      <div className="stat-value">{value}</div>
      <p className="stat-note">{note}</p>
    </div>
  );
}
