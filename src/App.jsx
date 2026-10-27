import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "cielosazules";

function isVideo(item) {
  return (item.mimeType || "").startsWith("video/");
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-CO");
}

// Enrutado mínimo por ruta: "/" es la galería y "/admin" el panel.
function usePath() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(to) {
    if (to !== window.location.pathname) window.history.pushState({}, "", to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return [path.replace(/\/+$/, "") || "/", navigate];
}

function MediaCard({ item, admin, onOpen, onDownload, onDelete }) {
  const url = item.url;
  if (!url) return null;
  return (
    <article
      className={admin ? "admin-item" : "media-card"}
      onClick={admin ? undefined : () => onOpen(item)}
    >
      <div className="media-thumb">
        {isVideo(item) ? (
          <>
            <video src={url} muted preload="metadata" />
            <span className="video-mark">▶</span>
          </>
        ) : (
          <img src={url} alt="Recuerdo de boda" loading="lazy" />
        )}
      </div>
      <div className="media-meta">
        <span>{formatDate(item._creationTime)}</span>
        {item.fileName && <span className="media-name">{item.fileName}</span>}
      </div>
      {admin && (
        <div className="admin-controls" onClick={(e) => e.stopPropagation()}>
          <button className="mini-btn" onClick={() => onDownload(item)}>Descargar</button>
          <button className="mini-btn mini-danger" onClick={() => onDelete(item)}>Eliminar</button>
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h3>Aún no hay recuerdos</h3>
      <p>Sé el primero en compartir una foto o un video.</p>
    </div>
  );
}

function HomeView({ items, onOpen }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [status, setStatus] = useState({ msg: "", type: "" });
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const generateUploadUrl = useMutation(api.memories.generateUploadUrl);
  const saveMemory = useMutation(api.memories.save);

  function handleFiles(files) {
    const valid = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setSelectedFiles(valid);
    if (files.length && !valid.length) setStatus({ msg: "Selecciona imágenes o videos.", type: "error" });
    else setStatus({ msg: "", type: "" });
  }

  async function handleUpload() {
    if (!selectedFiles.length) {
      setStatus({ msg: "Selecciona al menos una foto o video.", type: "error" });
      return;
    }
    setStatus({ msg: `Subiendo ${selectedFiles.length} archivo(s)…`, type: "" });
    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { storageId } = await res.json();
        await saveMemory({
          storageId,
          guest: "Invitado",
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus({ msg: "¡Gracias! Tus recuerdos se guardaron correctamente.", type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ msg: "No se pudo subir. Revisa tu conexión o el tamaño (máx 100 MB).", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <section className="hero">
        <span className="eyebrow">Nuestro día · 2026</span>
        <h1>Guarda cada momento</h1>
        <p>Comparte tus fotos y videos, y revive los de todos los invitados.</p>
      </section>

      <section className="upload">
        <label
          className={`drop-zone${dragging ? " dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles([...e.dataTransfer.files]);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => handleFiles([...e.target.files])}
          />
          <span className="drop-title">Arrastra tus archivos aquí</span>
          <span className="drop-sub">o haz clic para elegirlos · JPG, PNG, HEIC, MP4, MOV</span>
        </label>

        {!!selectedFiles.length && (
          <ul className="selected-files">
            {selectedFiles.map((f) => (
              <li key={f.name + f.size}>
                <span>{f.name}</span>
                <span className="muted">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        )}

        <button className="primary-btn" onClick={handleUpload} disabled={uploading}>
          {uploading ? "Subiendo…" : "Subir recuerdos"}
        </button>
        <div className={`status ${status.type}`}>{status.msg}</div>
      </section>

      <section className="gallery">
        <header className="gallery-head">
          <span className="eyebrow">En vivo</span>
          <h2>
            Fotos de los invitados
            {items.length > 0 && <span className="count"> ({items.length})</span>}
          </h2>
        </header>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="gallery-grid">
            {items.map((item) => (
              <MediaCard key={item._id} item={item} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AdminView({ items }) {
  const [logged, setLogged] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const removeMemory = useMutation(api.memories.remove);
  const clearAll = useMutation(api.memories.clearAll);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((x) => String(x.fileName || "").toLowerCase().includes(q));
  }, [items, search]);

  const photos = items.filter((x) => !isVideo(x)).length;
  const videos = items.filter(isVideo).length;

  function login() {
    if (password === ADMIN_PASSWORD) {
      setLogged(true);
      setError("");
    } else {
      setError("Contraseña incorrecta.");
    }
  }

  function downloadItem(item) {
    if (!item.url) return;
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.fileName || "recuerdo";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function deleteItem(item) {
    if (!window.confirm("¿Eliminar este recuerdo?")) return;
    await removeMemory({ id: item._id });
  }

  async function handleClearAll() {
    if (!items.length) return;
    if (window.confirm("¿Seguro que deseas eliminar TODOS los recuerdos? Esta acción no se puede deshacer.")) {
      await clearAll({});
    }
  }

  if (!logged) {
    return (
      <section className="login">
        <div className="login-card">
          <span className="eyebrow">Área privada</span>
          <h2>Panel de administración</h2>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") login(); }}
          />
          <button className="primary-btn full" onClick={login}>Entrar</button>
          {error && <div className="error-msg">{error}</div>}
        </div>
      </section>
    );
  }

  return (
    <section className="admin">
      <header className="admin-top">
        <div>
          <span className="eyebrow">Administración</span>
          <h2>Recuerdos recibidos</h2>
        </div>
        <div className="admin-actions">
          <button
            className="ghost-btn"
            onClick={() => {
              if (!items.length) { window.alert("No hay archivos para descargar."); return; }
              items.forEach((x, i) => setTimeout(() => downloadItem(x), i * 250));
            }}
          >
            Descargar todo
          </button>
          <button className="danger-btn" onClick={handleClearAll}>Eliminar todo</button>
        </div>
      </header>

      <div className="stats">
        <div><strong>{items.length}</strong><span>Archivos</span></div>
        <div><strong>{photos}</strong><span>Fotos</span></div>
        <div><strong>{videos}</strong><span>Videos</span></div>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre de archivo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="ghost-btn" onClick={() => { setLogged(false); setPassword(""); }}>
          Cerrar sesión
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No hay archivos</h3>
          <p>Los recuerdos que suban los invitados aparecerán aquí.</p>
        </div>
      ) : (
        <div className="admin-grid">
          {filtered.map((item) => (
            <MediaCard
              key={item._id}
              item={item}
              admin
              onDownload={downloadItem}
              onDelete={deleteItem}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [path, navigate] = usePath();
  const [lightbox, setLightbox] = useState(null);
  const items = useQuery(api.memories.list) ?? [];
  const isAdmin = path === "/admin";

  return (
    <>
      <header className="navbar">
        <a href="/" className="brand" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          Wedding Memories
        </a>
        {isAdmin ? (
          <a href="/" className="nav-link" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            Volver a la galería
          </a>
        ) : null}
      </header>

      <main>
        {isAdmin ? <AdminView items={items} /> : <HomeView items={items} onOpen={setLightbox} />}
      </main>

      {lightbox?.url && (
        <div className="lightbox" onClick={(e) => { if (e.target.classList.contains("lightbox")) setLightbox(null); }}>
          <button className="lightbox-close" aria-label="Cerrar" onClick={() => setLightbox(null)}>×</button>
          <div>
            {isVideo(lightbox)
              ? <video src={lightbox.url} controls autoPlay />
              : <img src={lightbox.url} alt="" />}
          </div>
        </div>
      )}

      <footer>
        <span>Con cariño, para un día inolvidable</span>
        {!isAdmin && (
          <a href="/admin" className="footer-admin" onClick={(e) => { e.preventDefault(); navigate("/admin"); }}>
            Administración
          </a>
        )}
      </footer>
    </>
  );
}
