"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type AgendaItem = { id: string; date: string; time: string; title: string };
type Article = { id: string; title: string; authorName: string; authorRole: string; body: string };
type Classified = { id: string; title: string; price: string; contact: string; body: string };
type PdfPage = { id: string; name: string; data: string };
type Newsletter = {
  id: string;
  title: string;
  issueDate: string;
  logo: string;
  fontFamily: string;
  published: boolean;
  agenda: AgendaItem[];
  articles: Article[];
  classifieds: Classified[];
  pdfPages: PdfPage[];
  updatedAt: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
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
  title: "Cross Bearings",
  issueDate: new Date().toISOString().slice(0, 10),
  logo: "",
  fontFamily: FONT_OPTIONS[0].stack,
  published: false,
  agenda: [
    { id: uid(), date: "Jul 1", time: "6:00 PM", title: "Wednesday Night Racing" },
    { id: uid(), date: "Jul 3", time: "6:30 PM", title: "Spring / Summer Series" },
    { id: uid(), date: "Jul 5", time: "8:00 AM", title: "Sunday Centerboard Series" },
  ],
  articles: [
    {
      id: uid(),
      title: "From the Helm",
      authorName: "Tim Willford",
      authorRole: "Commodore",
      body: "<p><strong>Welcome to a new season on the water.</strong> Use this space for club news, member updates, and stories from the fleet.</p><p>Add as many articles as you need, then drag them into the perfect reading order.</p>",
    },
    {
      id: uid(),
      title: "First Mate’s Log",
      authorName: "",
      authorRole: "First Mate",
      body: "<p>The docks are busy, the boats are returning, and summer is officially underway. We look forward to seeing everyone at the club.</p>",
    },
  ],
  classifieds: [
    { id: uid(), title: "For Sale: Club Dinghy", price: "$750", contact: "Contact the club office", body: "Well-maintained and ready to sail." },
  ],
  pdfPages: [],
  updatedAt: new Date().toISOString(),
});

const STORE = "harborpress-newsletters-v1";

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const command = (cmd: string) => {
    document.execCommand(cmd);
    onChange(ref.current?.innerHTML || "");
    ref.current?.focus();
  };
  return (
    <div className="rich-wrap">
      <div className="rich-tools" aria-label="Text formatting">
        <button type="button" onClick={() => command("bold")}><b>B</b></button>
        <button type="button" onClick={() => command("italic")}><i>I</i></button>
        <button type="button" onClick={() => command("insertUnorderedList")}>• List</button>
      </div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
}

function MoveButtons({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return <span className="move-buttons"><button onClick={onUp} title="Move up">↑</button><button onClick={onDown} title="Move down">↓</button></span>;
}

export default function Home() {
  const [issues, setIssues] = useState<Newsletter[]>([]);
  const [activeId, setActiveId] = useState("");
  const [tab, setTab] = useState<"details" | "agenda" | "articles" | "classifieds" | "pages">("details");
  const [view, setView] = useState<"editor" | "published">("editor");
  const [ready, setReady] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORE);
    const parsed = saved
      ? JSON.parse(saved).map((item: Newsletter) => ({
          ...item,
          fontFamily: item.fontFamily || FONT_OPTIONS[0].stack,
          articles: item.articles.map((article) => ({
            ...article,
            authorName: article.authorName || "",
            authorRole: article.authorRole || "",
          })),
        }))
      : [freshIssue()];
    setIssues(parsed);
    setActiveId(parsed[0]?.id || "");
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(STORE, JSON.stringify(issues));
  }, [issues, ready]);

  const issue = issues.find((i) => i.id === activeId) || issues[0];
  const update = (patch: Partial<Newsletter>) => setIssues((all) => all.map((i) => i.id === issue.id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i));
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
  const exportHtml = () => {
    const styles = Array.from(document.querySelectorAll("style,link[rel='stylesheet']")).map((n) => n.outerHTML).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${issue.title}</title>${styles}</head><body><main class="export-shell">${previewRef.current?.outerHTML || ""}</main></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${issue.title.replace(/\s+/g, "-").toLowerCase()}-${issue.issueDate}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const printPdf = () => window.print();
  const createIssue = () => {
    const next = freshIssue();
    setIssues((all) => [next, ...all]);
    setActiveId(next.id);
    setView("editor");
  };

  if (!ready || !issue) return <div className="loading">Preparing your newsroom…</div>;
  const published = issues.filter((i) => i.published);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">HP</span><span><b>Harbor Press</b><small>Newsletter studio</small></span></div>
        <nav><button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>Editor</button><button className={view === "published" ? "active" : ""} onClick={() => setView("published")}>Published <em>{published.length}</em></button></nav>
        <div className="top-actions"><button className="ghost" onClick={exportHtml}>Export HTML</button><button className="primary" onClick={printPdf}>Generate PDF</button></div>
      </header>

      {view === "published" ? (
        <section className="library">
          <div className="library-head"><div><p className="eyebrow">Public archive</p><h1>Published newsletters</h1><p>Only issues marked published appear here.</p></div><button className="primary" onClick={createIssue}>+ New issue</button></div>
          <div className="issue-grid">{published.length ? published.map((item) => (
            <article className="issue-card" key={item.id} onClick={() => { setActiveId(item.id); setView("editor"); }}>
              <div className="issue-thumb">{item.logo ? <img src={item.logo} alt="" /> : <span>{item.title.slice(0, 2)}</span>}</div>
              <p>{new Date(item.issueDate + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p><h2>{item.title}</h2><span>Published</span>
            </article>
          )) : <div className="empty"><h2>No published issues yet</h2><p>Open an issue in the editor and switch its status to Published.</p></div>}</div>
        </section>
      ) : (
        <div className="workspace">
          <aside className="issue-rail">
            <div className="rail-head"><span>Issues</span><button onClick={createIssue}>+</button></div>
            {issues.map((item) => <button key={item.id} className={`issue-row ${item.id === issue.id ? "selected" : ""}`} onClick={() => setActiveId(item.id)}>
              <span className={`status-dot ${item.published ? "live" : ""}`} /><span><b>{item.title}</b><small>{item.issueDate}</small></span>
            </button>)}
          </aside>

          <section className="editor-panel">
            <div className="editor-title"><div><p className="eyebrow">Issue builder</p><h1>{issue.title}</h1></div><label className="publish-toggle"><span>{issue.published ? "Published" : "Unpublished"}</span><input type="checkbox" checked={issue.published} onChange={(e) => update({ published: e.target.checked })} /><i /></label></div>
            <div className="tabs">
              {(["details", "agenda", "articles", "classifieds", "pages"] as const).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name === "pages" ? "PDF pages" : name}</button>)}
            </div>
            <div className="form-scroll">
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
                {issue.agenda.map((item, index) => <div className="item-card agenda-card" key={item.id}><div className="card-tools"><MoveButtons onUp={() => update({ agenda: reorder(issue.agenda, index, -1) })} onDown={() => update({ agenda: reorder(issue.agenda, index, 1) })} /><button className="delete" onClick={() => update({ agenda: issue.agenda.filter((x) => x.id !== item.id) })}>×</button></div>
                  <label>Event<input value={item.title} onChange={(e) => update({ agenda: issue.agenda.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })} /></label><div className="field-row"><label>Date<input value={item.date} onChange={(e) => update({ agenda: issue.agenda.map((x) => x.id === item.id ? { ...x, date: e.target.value } : x) })} /></label><label>Time<input value={item.time} onChange={(e) => update({ agenda: issue.agenda.map((x) => x.id === item.id ? { ...x, time: e.target.value } : x) })} /></label></div></div>)}
                <button className="add-button" onClick={() => update({ agenda: [...issue.agenda, { id: uid(), date: "", time: "", title: "New event" }] })}>+ Add event</button>
              </div>}
              {tab === "articles" && <div className="form-section"><h2>Articles</h2><p className="helper">Build stories and arrange their reading order.</p>
                {issue.articles.map((item, index) => <div className="item-card" key={item.id}><div className="card-tools"><MoveButtons onUp={() => update({ articles: reorder(issue.articles, index, -1) })} onDown={() => update({ articles: reorder(issue.articles, index, 1) })} /><button className="delete" onClick={() => update({ articles: issue.articles.filter((x) => x.id !== item.id) })}>×</button></div><label>Article title<input value={item.title} onChange={(e) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })} /></label><div className="field-row"><label>Author name<input placeholder="Tim Willford" value={item.authorName} onChange={(e) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, authorName: e.target.value } : x) })} /></label><label>Author role<input placeholder="Commodore" value={item.authorRole} onChange={(e) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, authorRole: e.target.value } : x) })} /></label></div><label>Story</label><RichEditor value={item.body} onChange={(body) => update({ articles: issue.articles.map((x) => x.id === item.id ? { ...x, body } : x) })} /></div>)}
                <button className="add-button" onClick={() => update({ articles: [...issue.articles, { id: uid(), title: "New article", authorName: "", authorRole: "", body: "<p>Start writing here…</p>" }] })}>+ Add article</button>
              </div>}
              {tab === "classifieds" && <div className="form-section"><h2>Classifieds & for sale</h2><p className="helper">Collect member listings in one easy-to-scan section.</p>
                {issue.classifieds.map((item, index) => <div className="item-card" key={item.id}><div className="card-tools"><MoveButtons onUp={() => update({ classifieds: reorder(issue.classifieds, index, -1) })} onDown={() => update({ classifieds: reorder(issue.classifieds, index, 1) })} /><button className="delete" onClick={() => update({ classifieds: issue.classifieds.filter((x) => x.id !== item.id) })}>×</button></div><label>Listing title<input value={item.title} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x) })} /></label><div className="field-row"><label>Price<input value={item.price} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, price: e.target.value } : x) })} /></label><label>Contact<input value={item.contact} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, contact: e.target.value } : x) })} /></label></div><label>Description<textarea value={item.body} onChange={(e) => update({ classifieds: issue.classifieds.map((x) => x.id === item.id ? { ...x, body: e.target.value } : x) })} /></label></div>)}
                <button className="add-button" onClick={() => update({ classifieds: [...issue.classifieds, { id: uid(), title: "New listing", price: "", contact: "", body: "" }] })}>+ Add listing</button>
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
        </div>
      )}
    </main>
  );
}

function NewsletterPreview({ issue, previewRef }: { issue: Newsletter; previewRef: React.RefObject<HTMLDivElement | null> }) {
  return <div className="newsletter-pages" ref={previewRef} style={{ fontFamily: issue.fontFamily || FONT_OPTIONS[0].stack }}>
    <article className="newsletter-page">
      <header className="masthead">{issue.logo ? <img src={issue.logo} alt="" /> : <div className="logo-placeholder">HP</div>}<div><p>{new Date(issue.issueDate + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p><h1>{issue.title}</h1><span>News, notices & stories from the community</span></div></header>
      <div className="rule" />
      <div className="newsletter-columns">
        <section className="agenda-preview"><h2>Dates to remember</h2>{issue.agenda.map((item) => <div className="event-line" key={item.id}><b>{item.date}</b><span>{item.title}</span><em>{item.time}</em></div>)}</section>
        {issue.articles.map((article) => <section className="story" key={article.id}><h2>{article.title}</h2>{(article.authorName || article.authorRole) && <p className="article-byline">{article.authorName}{article.authorName && article.authorRole ? <span> · </span> : null}{article.authorRole}</p>}<div dangerouslySetInnerHTML={{ __html: article.body }} /></section>)}
        {issue.classifieds.length > 0 && <section className="classified-preview"><h2>Classifieds & For Sale</h2>{issue.classifieds.map((item) => <div key={item.id}><h3>{item.title} <b>{item.price}</b></h3><p>{item.body}</p><small>{item.contact}</small></div>)}</section>}
      </div>
      <footer>{issue.title} <span>•</span> {new Date(issue.issueDate + "T12:00:00").toLocaleDateString()}</footer>
    </article>
    {issue.pdfPages.map((page, index) => <article className="newsletter-page attachment-page" key={page.id}><div><span>Attached PDF {index + 1}</span><h2>{page.name}</h2><a href={page.data} target="_blank" rel="noreferrer">Open attached page</a></div></article>)}
  </div>;
}
