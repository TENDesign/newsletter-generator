"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type AgendaItem = { id: string; date: string; time: string; title: string; notes?: string };
type Article = { id: string; title: string; authorName: string; authorRole: string; body: string };
type Memorial = { id: string; name: string; body: string; image: string };
type NewsItem = { id: string; title: string; body: string };
type Classified = { id: string; title: string; price: string; contact: string; body: string };
type PdfPage = { id: string; name: string; data: string };
type Newsletter = {
  id: string;
  title: string;
  issueDate: string;
  logo: string;
  fontFamily: string;
  locked?: boolean;
  agenda: AgendaItem[];
  articles: Article[];
  memorials: Memorial[];
  newsItems: NewsItem[];
  classifieds: Classified[];
  pdfPages: PdfPage[];
  updatedAt: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const getAgendaDateParts = (value: string) => {
  const match = value.match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);
  return match ? { month: match[1], day: match[2] } : { month: "", day: "" };
};
const daysInAgendaMonth = (month: string) => {
  const monthNumber = Number(month);
  if (monthNumber === 2) return 29;
  if ([4, 6, 9, 11].includes(monthNumber)) return 30;
  return 31;
};
const formatAgendaDate = (value: string) => {
  const { month, day } = getAgendaDateParts(value);
  if (!month || !day) return value;
  return `${MONTHS[Number(month) - 1].slice(0, 3)} ${Number(day)}`;
};
const formatAgendaTime = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return value;
  const [hour, minute] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const FONT_OPTIONS = [
  { name: "Lora", stack: "'Lora', Georgia, serif" },
  { name: "Merriweather", stack: "'Merriweather', Georgia, serif" },
  { name: "Roboto", stack: "'Roboto', Arial, sans-serif" },
  { name: "Open Sans", stack: "'Open Sans', Arial, sans-serif" },
  { name: "Montserrat", stack: "'Montserrat', Arial, sans-serif" },
  { name: "Playfair Display", stack: "'Playfair Display', Georgia, serif" },
];
const freshIssue = (): Newsletter => ({
  id: uid(),
  title: "Newsletter Title",
  issueDate: new Date().toISOString().slice(0, 10),
  logo: "",
  fontFamily: FONT_OPTIONS[0].stack,
  agenda: [
    { id: uid(), date: "", time: "", title: "Event Title", notes: "" },
  ],
  articles: [
    {
      id: uid(),
      title: "Article Title",
      authorName: "Author Name",
      authorRole: "Author Role",
      body: "<p>Add article content here.</p>",
    },
  ],
  memorials: [],
  newsItems: [],
  classifieds: [
    { id: uid(), title: "Classified Item", price: "", contact: "Contact Information", body: "Add a short description here." },
  ],
  pdfPages: [],
  updatedAt: new Date().toISOString(),
});

const STORE = "harborpress-newsletters-v1";
const normalizeIssues = (value: unknown): Newsletter[] => {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const item = raw as Partial<Newsletter>;
    return {
      ...freshIssue(),
      ...item,
      id: item.id || uid(),
      fontFamily: item.fontFamily || FONT_OPTIONS[0].stack,
      agenda: item.agenda || [],
      articles: (item.articles || []).map((article) => ({
        ...article,
        authorName: article.authorName || "",
        authorRole: article.authorRole || "",
      })),
      memorials: item.memorials || [],
      newsItems: item.newsItems || [],
      classifieds: item.classifieds || [],
      pdfPages: item.pdfPages || [],
    };
  });
};

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = ref.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);
  const command = (cmd: string) => {
    document.execCommand(cmd);
    onChange(ref.current?.innerHTML || "");
    ref.current?.focus();
  };
  const pastePlainText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      ref.current?.focus();
      document.execCommand("insertText", false, text);
      ref.current?.querySelectorAll("*").forEach((element) => {
        Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
      });
      onChange(ref.current?.innerHTML || "");
    } catch {
      window.alert("Clipboard access was blocked. Use Ctrl+Shift+V or Command+Shift+V to paste without formatting.");
    }
  };
  return (
    <div className="rich-wrap">
      <div className="rich-tools" aria-label="Text formatting">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => command("bold")}><b>B</b></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => command("italic")}><i>I</i></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => command("insertUnorderedList")}>• List</button>
        <button type="button" className="paste-plain" onMouseDown={(e) => e.preventDefault()} onClick={pastePlainText}>Paste as plain text</button>
      </div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
}

function MoveButtons({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return <span className="move-buttons"><button onClick={onUp} title="Move up">↑</button><button onClick={onDown} title="Move down">↓</button></span>;
}

function CollapsibleItem({ title, open, onToggle, onUp, onDown, onDuplicate, onDelete, children }: { title: string; open: boolean; onToggle: () => void; onUp: () => void; onDown: () => void; onDuplicate?: () => void; onDelete: () => void; children: React.ReactNode }) {
  return <div className={`item-card collapsible-item ${open ? "is-open" : ""}`}><div className="collapse-header"><button type="button" className="collapse-toggle" onClick={onToggle} aria-expanded={open}><span>{open ? "−" : "+"}</span><b>{title || "Untitled item"}</b></button><div className="card-tools"><MoveButtons onUp={onUp} onDown={onDown} />{onDuplicate && <button className="duplicate" title="Duplicate item" aria-label="Duplicate item" onClick={onDuplicate}>⧉</button>}<button className="delete" onClick={onDelete}>×</button></div></div>{open && <div className="collapse-content">{children}</div>}</div>;
}

export default function Home() {
  const [issues, setIssues] = useState<Newsletter[]>([]);
  const [activeId, setActiveId] = useState("");
  const [tab, setTab] = useState<"details" | "agenda" | "articles" | "memorials" | "news" | "classifieds" | "pages">("details");
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [maxPreviewWidth, setMaxPreviewWidth] = useState(false);
  const [ready, setReady] = useState(false);
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; date: string } | null>(null);
  const [deleteDateInput, setDeleteDateInput] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [pendingUnlock, setPendingUnlock] = useState(false);
  const [unlockDateInput, setUnlockDateInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [dataDirectory, setDataDirectory] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const desktop = window.harborPressDesktop;
        let stored: unknown = null;
        if (desktop) {
          stored = await desktop.loadIssues();
          setDataDirectory(await desktop.getDataDirectory());
        }
        if (!stored) {
          const browserData = localStorage.getItem(STORE);
          stored = browserData ? JSON.parse(browserData) : null;
        }
        const parsed = normalizeIssues(stored);
        const initialIssues = parsed.length ? parsed : [freshIssue()];
        if (!active) return;
        setIssues(initialIssues);
        setActiveId(initialIssues[0]?.id || "");
        setReady(true);
      } catch {
        if (!active) return;
        const fallback = [freshIssue()];
        setIssues(fallback);
        setActiveId(fallback[0].id);
        setReady(true);
      }
    };
    void initialize();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      if (window.harborPressDesktop) void window.harborPressDesktop.saveIssues(issues);
      else localStorage.setItem(STORE, JSON.stringify(issues));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [issues, ready]);

  const issue = issues.find((i) => i.id === activeId) || issues[0];
  const update = (patch: Partial<Newsletter>) => setIssues((all) => all.map((i) => i.id === issue.id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i));
  const toggleItem = (id: string) => setOpenItems((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openNewItem = (id: string) => setOpenItems((current) => new Set(current).add(id));
  const updateAgendaDate = (item: AgendaItem, month: string, day: string) => {
    const clampedDay = day && month ? String(Math.min(Number(day), daysInAgendaMonth(month))).padStart(2, "0") : day;
    const date = month && clampedDay ? `${month}-${clampedDay}` : "";
    update({ agenda: issue.agenda.map((entry) => entry.id === item.id ? { ...entry, date } : entry) });
  };
  const reorder = <T,>(items: T[], index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return items;
    const copy = [...items];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    return copy;
  };
  const loadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const addPdf = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => update({ pdfPages: [...issue.pdfPages, { id: uid(), name: file.name, data: String(reader.result) }] });
      reader.readAsDataURL(file);
    });
  };
  const loadMemorialImage = (memorialId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ memorials: issue.memorials.map((item) => item.id === memorialId ? { ...item, image: String(reader.result) } : item) });
    reader.readAsDataURL(file);
  };
  const generatePdf = async () => {
    const desktop = window.harborPressDesktop;
    if (!desktop) {
      window.alert("Direct PDF generation is available in the Harbor Press desktop app.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const deadline = Date.now() + 30000;
      while (document.querySelector(".attachment-loading") && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      if (document.querySelector(".attachment-loading")) {
        window.alert("The attached PDF pages are still loading. Please try again in a moment.");
        return;
      }
      const result = await desktop.generatePdf(`${issue.title} - ${issue.issueDate}`);
      if (!result.canceled && result.filePath) window.alert(`PDF saved to:\n${result.filePath}`);
    } catch {
      window.alert("The PDF could not be generated. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };
  const createIssue = () => {
    const next = freshIssue();
    setIssues((all) => [next, ...all]);
    setActiveId(next.id);
    setView("editor");
  };
  const requestIssueDelete = (issueId: string, issueTitle: string, issueDate: string) => {
    setPendingDelete({ id: issueId, title: issueTitle, date: issueDate });
    setDeleteDateInput("");
    setDeleteError("");
  };
  const deleteIssue = () => {
    if (!pendingDelete) return;
    if (deleteDateInput.trim() !== pendingDelete.date) {
      setDeleteError("The issue date does not match. The issue has not been deleted.");
      return;
    }
    const remaining = issues.filter((item) => item.id !== pendingDelete.id);
    if (remaining.length === 0) {
      const replacement = freshIssue();
      setIssues([replacement]);
      setActiveId(replacement.id);
    } else {
      setIssues(remaining);
      if (activeId === pendingDelete.id) setActiveId(remaining[0].id);
    }
    setPendingDelete(null);
    setDeleteDateInput("");
    setDeleteError("");
  };
  const unlockIssue = () => {
    if (unlockDateInput.trim() !== issue.issueDate) {
      setUnlockError("The issue date does not match. The issue remains locked.");
      return;
    }
    update({ locked: false });
    setPendingUnlock(false);
    setUnlockDateInput("");
    setUnlockError("");
  };

  if (!ready || !issue) return <div className="loading">Preparing your newsroom…</div>;
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">HP</span><span><b>Harbor Press</b><small>Newsletter studio</small></span></div>
        <nav><button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>Editor</button><button className={view === "preview" ? "active" : ""} onClick={() => setView("preview")}>Preview</button></nav>
        <div className="top-actions">{dataDirectory && <button className="ghost" title={dataDirectory} onClick={() => { void window.harborPressDesktop?.openDataDirectory(); }}>Data folder</button>}<button className="primary" disabled={generatingPdf} onClick={() => { void generatePdf(); }}>{generatingPdf ? "Generating…" : "Generate PDF"}</button></div>
      </header>

      {view === "editor" ? <div className="workspace">
          <aside className="issue-rail">
            <div className="rail-head"><span>Issues</span><button onClick={createIssue}>+</button></div>
            {issues.map((item) => <div className="issue-row-wrap" key={item.id}><button className={`issue-row ${item.id === issue.id ? "selected" : ""}`} onClick={() => setActiveId(item.id)}>
              <span className="status-dot" /><span><b>{item.title}</b><small>{item.issueDate}</small></span>
            </button><button className="issue-delete" title={`Delete ${item.title}`} aria-label={`Delete ${item.title}`} onClick={() => requestIssueDelete(item.id, item.title, item.issueDate)}>×</button></div>)}
          </aside>

          <section className={`editor-panel ${issue.locked ? "issue-locked" : ""}`}>
            <div className="editor-title"><div><p className="eyebrow">Issue builder</p><h1>{issue.title}</h1></div><button className={`issue-lock-button ${issue.locked ? "locked" : ""}`} onClick={() => { if (issue.locked) { setPendingUnlock(true); setUnlockDateInput(""); setUnlockError(""); } else { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); update({ locked: true }); } }} aria-pressed={Boolean(issue.locked)}>{issue.locked ? "🔒 Unlock issue" : "🔓 Lock issue"}</button></div>
            <div className="tabs">
              {(["details", "agenda", "articles", "memorials", "news", "classifieds", "pages"] as const).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name === "pages" ? "PDF pages" : name === "news" ? "In the News" : name}</button>)}
            </div>
            <div className="form-scroll" inert={issue.locked ? true : undefined}>
              {tab === "details" && <div className="form-section">
                <h2>Issue details</h2><p className="helper">Set the identity that appears at the top of every newsletter.</p>
                <label>Newsletter title<input value={issue.title} onChange={(e) => update({ title: e.target.value })} /></label>
                <label>Issue date<input type="date" value={issue.issueDate} onChange={(e) => update({ issueDate: e.target.value })} /></label>
                <label>Newsletter font
                  <select value={issue.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}>
                    {FONT_OPTIONS.map((font) => <option key={font.name} value={font.stack}>{font.name}</option>)}
                  </select>
                  <small className="field-note">Choose from a simple selection of popular Google Fonts.</small>
                </label>
                <label>Logo</label><label className="upload-box">{issue.logo ? <img src={issue.logo} alt="Newsletter logo" /> : <span className="upload-icon">↥</span>}<span><b>{issue.logo ? "Replace logo" : "Upload your logo"}</b><small>PNG or JPG works best</small></span><input type="file" accept="image/*" onChange={loadImage} /></label>
              </div>}
              {tab === "agenda" && <div className="form-section"><h2>Agenda & calendar</h2><p className="helper">Add dates in the order readers should see them.</p>
                {issue.agenda.map((item, index) => <CollapsibleItem key={item.id} title={`${item.date ? `${formatAgendaDate(item.date)} · ` : ""}${item.time ? `${formatAgendaTime(item.time)} · ` : ""}${item.title}`} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} onUp={() => update({ agenda: reorder(issue.agenda, index, -1) })} onDown={() => update({ agenda: reorder(issue.agenda, index, 1) })} onDuplicate={() => { const duplicate = { ...item, id: uid() }; update({ agenda: [...issue.agenda, duplicate] }); openNewItem(duplicate.id); }} onDelete={() => update({ agenda: issue.agenda.filter((x) => x.id !== item.id) })}>
                  <label>Event<input value={item.title} onChange={(e) => update({ agenda: issue.agenda.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })} /></label><div className="field-row"><fieldset className="date-pickers"><legend>Date</legend><div><select aria-label="Event month" value={getAgendaDateParts(item.date).month} onChange={(e) => updateAgendaDate(item, e.target.value, getAgendaDateParts(item.date).day || "01")}><option value="">Month</option>{MONTHS.map((month, monthIndex) => <option key={month} value={String(monthIndex + 1).padStart(2, "0")}>{month}</option>)}</select><select aria-label="Event day" value={getAgendaDateParts(item.date).day} onChange={(e) => updateAgendaDate(item, getAgendaDateParts(item.date).month || "01", e.target.value)}><option value="">Day</option>{Array.from({ length: daysInAgendaMonth(getAgendaDateParts(item.date).month) }, (_, dayIndex) => <option key={dayIndex + 1} value={String(dayIndex + 1).padStart(2, "0")}>{dayIndex + 1}</option>)}</select></div>{item.date && !getAgendaDateParts(item.date).month && <small className="legacy-value">Current: {item.date}</small>}</fieldset><label>Time<input type="time" value={/^\d{2}:\d{2}$/.test(item.time) ? item.time : ""} onChange={(e) => update({ agenda: issue.agenda.map((x) => x.id === item.id ? { ...x, time: e.target.value } : x) })} />{item.time && !/^\d{2}:\d{2}$/.test(item.time) && <small className="legacy-value">Current: {item.time}</small>}</label></div><label>Notes <span className="optional-label">(optional)</span><textarea placeholder="Add location, instructions, or other details" value={item.notes || ""} onChange={(e) => update({ agenda: issue.agenda.map((x) => x.id === item.id ? { ...x, notes: e.target.value } : x) })} /></label></CollapsibleItem>)}
                <button className="add-button" onClick={() => { const id = uid(); update({ agenda: [...issue.agenda, { id, date: "", time: "", title: "Event Title", notes: "" }] }); openNewItem(id); }}>+ Add event</button>
              </div>}
              {tab === "articles" && <div className="form-section"><h2>Articles</h2><p className="helper">Build stories and arrange their reading order.</p>
                {issue.articles.map((item, index) => <CollapsibleItem key={item.id} title={item.title} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} onUp={() => update({ articles: reorder(issue.articles, index, -1) })} onDown={() => update({ articles: reorder(issue.articles, index, 1) })} onDelete={() => update({ articles: issue.articles.filter((x) => x.id !== item.id) })}><label>Article title<input value={item.title} onChange={(e) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })} /></label><div className="field-row"><label>Author name<input placeholder="Author Name" value={item.authorName} onChange={(e) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, authorName: e.target.value } : x) })} /></label><label>Author role<input placeholder="Author Role" value={item.authorRole} onChange={(e) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, authorRole: e.target.value } : x) })} /></label></div><label>Story</label><RichEditor value={item.body} onChange={(body) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, body } : x) })} /></CollapsibleItem>)}
                <button className="add-button" onClick={() => { const id = uid(); update({ articles: [...issue.articles, { id, title: "Article Title", authorName: "", authorRole: "", body: "<p>Add article content here.</p>" }] }); openNewItem(id); }}>+ Add article</button>
              </div>}
              {tab === "memorials" && <div className="form-section"><h2>Memorials</h2><p className="helper">Honor members with a name, remembrance, and optional photograph.</p>
                {issue.memorials.map((item, index) => <CollapsibleItem key={item.id} title={item.name} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} onUp={() => update({ memorials: reorder(issue.memorials, index, -1) })} onDown={() => update({ memorials: reorder(issue.memorials, index, 1) })} onDelete={() => update({ memorials: issue.memorials.filter((x) => x.id !== item.id) })}><label>Name<input placeholder="Member name" value={item.name} onChange={(e) => update({ memorials: issue.memorials.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x) })} /></label><label>Remembrance</label><RichEditor value={item.body} onChange={(body) => update({ memorials: issue.memorials.map((x) => x.id === item.id ? { ...x, body } : x) })} /><label className="memorial-upload">{item.image ? <img src={item.image} alt="" /> : <span className="upload-icon">↥</span>}<span><b>{item.image ? "Replace photograph" : "Upload photograph"}</b><small>Optional · layout adjusts automatically</small></span><input type="file" accept="image/*" onChange={(e) => loadMemorialImage(item.id, e)} /></label>{item.image && <button className="remove-image" onClick={() => update({ memorials: issue.memorials.map((x) => x.id === item.id ? { ...x, image: "" } : x) })}>Remove photograph</button>}</CollapsibleItem>)}
                <button className="add-button" onClick={() => { const id = uid(); update({ memorials: [...issue.memorials, { id, name: "Name", body: "<p>Add remembrance text here.</p>", image: "" }] }); openNewItem(id); }}>+ Add memorial</button>
              </div>}
              {tab === "news" && <div className="form-section"><h2>In the News</h2><p className="helper">Collect short announcements, press mentions, and community updates.</p>
                {issue.newsItems.map((item, index) => <CollapsibleItem key={item.id} title={item.title} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} onUp={() => update({ newsItems: reorder(issue.newsItems, index, -1) })} onDown={() => update({ newsItems: reorder(issue.newsItems, index, 1) })} onDelete={() => update({ newsItems: issue.newsItems.filter((x) => x.id !== item.id) })}><label>Headline<input placeholder="News item headline" value={item.title} onChange={(e) => update({ newsItems: issue.newsItems.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })} /></label><label>News item</label><RichEditor value={item.body} onChange={(body) => update({ newsItems: issue.newsItems.map((x) => x.id === item.id ? { ...x, body } : x) })} /></CollapsibleItem>)}
                <button className="add-button" onClick={() => { const id = uid(); update({ newsItems: [...issue.newsItems, { id, title: "News Item Title", body: "<p>Add news content here.</p>" }] }); openNewItem(id); }}>+ Add news item</button>
              </div>}
              {tab === "classifieds" && <div className="form-section"><h2>Classifieds & for sale</h2><p className="helper">Collect member listings in one easy-to-scan section.</p>
                {issue.classifieds.map((item, index) => <CollapsibleItem key={item.id} title={item.title} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} onUp={() => update({ classifieds: reorder(issue.classifieds, index, -1) })} onDown={() => update({ classifieds: reorder(issue.classifieds, index, 1) })} onDelete={() => update({ classifieds: issue.classifieds.filter((x) => x.id !== item.id) })}><label>Listing title<input value={item.title} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })} /></label><div className="field-row"><label>Price<input placeholder="Contact for price" value={item.price} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, price: e.target.value } : x) })} /></label><label>Contact<input value={item.contact} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, contact: e.target.value } : x) })} /></label></div><label>Description<textarea value={item.body} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, body: e.target.value } : x) })} /></label></CollapsibleItem>)}
                <button className="add-button" onClick={() => { const id = uid(); update({ classifieds: [...issue.classifieds, { id, title: "Classified Item", price: "", contact: "", body: "" }] }); openNewItem(id); }}>+ Add listing</button>
              </div>}
              {tab === "pages" && <div className="form-section"><h2>Additional PDF pages</h2><p className="helper">Attach flyers, forms, and notices. Order is preserved with the issue.</p>
                {issue.pdfPages.map((page, index) => <div className="pdf-row" key={page.id}><span className="pdf-icon">PDF</span><span><b>{page.name}</b><small>Attached page</small></span><MoveButtons onUp={() => update({ pdfPages: reorder(issue.pdfPages, index, -1) })} onDown={() => update({ pdfPages: reorder(issue.pdfPages, index, 1) })} /><button className="delete" onClick={() => update({ pdfPages: issue.pdfPages.filter((x) => x.id !== page.id) })}>×</button></div>)}
                <label className="add-button upload-button">+ Add PDF pages<input type="file" accept="application/pdf" multiple onChange={addPdf} /></label>
              </div>}
            </div>
          </section>

          <section className="preview-panel">
            <div className="preview-toolbar"><span><i /> Live preview</span><span>US Letter · 8.5 × 11</span></div>
            <div className="paper-stage"><NewsletterPreview issue={issue} previewRef={previewRef} /></div>
          </section>
        </div> : <section className={`preview-only ${maxPreviewWidth ? "max-width" : ""}`}><div className="preview-toolbar"><span><i /> Full preview</span><div className="preview-options"><span>US Letter · 8.5 × 11</span><button onClick={() => setMaxPreviewWidth((current) => !current)} aria-pressed={maxPreviewWidth}>{maxPreviewWidth ? "Actual size" : "Zoom"}</button></div></div><div className="paper-stage"><NewsletterPreview issue={issue} previewRef={previewRef} /></div></section>}
      {pendingDelete && <div className="modal-backdrop" role="presentation"><section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title"><p className="eyebrow">Delete issue</p><h2 id="delete-modal-title">Delete “{pendingDelete.title}”?</h2><p>This cannot be undone. Type the issue date exactly as shown to confirm.</p><label>Issue date: <b>{pendingDelete.date}</b><input autoFocus value={deleteDateInput} placeholder="YYYY-MM-DD" onChange={(e) => { setDeleteDateInput(e.target.value); setDeleteError(""); }} onKeyDown={(e) => { if (e.key === "Enter") deleteIssue(); }} /></label>{deleteError && <p className="delete-error" role="alert">{deleteError}</p>}<div className="modal-actions"><button className="ghost" onClick={() => { setPendingDelete(null); setDeleteError(""); }}>Cancel</button><button className="danger-button" onClick={deleteIssue}>Delete issue</button></div></section></div>}
      {pendingUnlock && <div className="modal-backdrop" role="presentation"><section className="delete-modal unlock-modal" role="dialog" aria-modal="true" aria-labelledby="unlock-modal-title"><p className="eyebrow">Unlock issue</p><h2 id="unlock-modal-title">Unlock “{issue.title}”?</h2><p>Type the issue date exactly as shown to enable editing.</p><label>Issue date: <b>{issue.issueDate}</b><input autoFocus value={unlockDateInput} placeholder="YYYY-MM-DD" onChange={(e) => { setUnlockDateInput(e.target.value); setUnlockError(""); }} onKeyDown={(e) => { if (e.key === "Enter") unlockIssue(); }} /></label>{unlockError && <p className="delete-error" role="alert">{unlockError}</p>}<div className="modal-actions"><button className="ghost" onClick={() => { setPendingUnlock(false); setUnlockError(""); }}>Cancel</button><button className="primary" onClick={unlockIssue}>Unlock issue</button></div></section></div>}
    </main>
  );
}

function NewsletterPreview({ issue, previewRef }: { issue: Newsletter; previewRef: React.RefObject<HTMLDivElement | null> }) {
  return <div className="newsletter-pages" ref={previewRef} style={{ fontFamily: issue.fontFamily || FONT_OPTIONS[0].stack }}>
    <article className="newsletter-page">
      <header className="masthead">{issue.logo ? <img src={issue.logo} alt="" /> : <div className="logo-placeholder">HP</div>}<div><p>{new Date(issue.issueDate + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p><h1>{issue.title}</h1><span>News, notices & stories from the community</span></div></header>
      <div className="rule" />
      <div className="newsletter-columns"><NewsletterBody issue={issue} /></div>
      <footer>{issue.title} <span>•</span> {new Date(issue.issueDate + "T12:00:00").toLocaleDateString()}</footer>
    </article>
    {issue.pdfPages.map((page) => <PdfAttachmentPreview key={page.id} file={page} />)}
  </div>;
}

function NewsletterBody({ issue }: { issue: Newsletter }) {
  return <>
    {issue.agenda.length > 0 && <section className="agenda-preview"><h2>Dates to remember</h2>{issue.agenda.map((item) => <div className="event-line" key={item.id}><b>{formatAgendaDate(item.date)}</b><span>{item.title}</span><em>{formatAgendaTime(item.time)}</em>{item.notes?.trim() && <small className="event-notes">{item.notes}</small>}</div>)}</section>}
    {issue.articles.map((article) => <section className="story" key={article.id}><h2>{article.title}</h2>{(article.authorName || article.authorRole) && <p className="article-byline">{article.authorName}{article.authorName && article.authorRole ? <span> · </span> : null}{article.authorRole}</p>}<div dangerouslySetInnerHTML={{ __html: article.body }} /></section>)}
    {issue.memorials.length > 0 && <section className="memorials-preview"><h2 className="memorial-section-title">In Memoriam</h2>{issue.memorials.map((memorial) => <div className={`memorial-entry ${memorial.image ? "with-image" : "text-only"}`} key={memorial.id}>{memorial.image && <img src={memorial.image} alt={memorial.name} />}<div><h3>{memorial.name}</h3><div className="memorial-body" dangerouslySetInnerHTML={{ __html: memorial.body }} /></div></div>)}</section>}
    {issue.newsItems.length > 0 && <section className="news-preview"><h2 className="news-section-title">In the News</h2><div className="news-grid">{issue.newsItems.map((item) => <article className="news-entry" key={item.id}><h3>{item.title}</h3><div dangerouslySetInnerHTML={{ __html: item.body }} /></article>)}</div></section>}
    {issue.classifieds.length > 0 && <section className="classified-section"><h2>Classifieds & For Sale</h2><div className={`classified-preview ${issue.classifieds.length > 1 ? "multiple" : "single"}`}>{issue.classifieds.map((item) => <div key={item.id}><h3>{item.title} <b>{item.price.trim() || "Contact for price"}</b></h3><p>{item.body}</p><small>{item.contact}</small></div>)}</div></section>}
  </>;
}

function PdfAttachmentPreview({ file }: { file: PdfPage }) {
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const renderPdf = async () => {
      try {
        setImages([]);
        setError("");
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const source = new Uint8Array(await (await fetch(file.data)).arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: source }).promise;
        const rendered: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.6 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is unavailable.");
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          rendered.push(canvas.toDataURL("image/jpeg", 0.94));
        }
        if (!cancelled) setImages(rendered);
      } catch {
        if (!cancelled) setError("This PDF could not be rendered.");
      }
    };
    void renderPdf();
    return () => { cancelled = true; };
  }, [file.data]);

  if (error) return <article className="newsletter-page attachment-page attachment-fallback"><h2>{file.name}</h2><p>{error}</p><a href={file.data} target="_blank" rel="noreferrer">Open attached PDF</a></article>;
  if (!images.length) return <article className="newsletter-page attachment-page attachment-loading"><p>Rendering {file.name}…</p></article>;
  return <>{images.map((image, pageIndex) => <article className="newsletter-page attachment-page" key={`${file.id}-${pageIndex}`}><img src={image} alt={`${file.name}, page ${pageIndex + 1}`} /></article>)}</>;
}
