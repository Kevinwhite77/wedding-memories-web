import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "admin123";

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
      <div className={admin ? "admin-meta" : "media-info"}>
        <small>
          {formatDate(item._creationTime)}
          {item.fileName ? ` · ${item.fileName}` : ""}
        </small>
      </div>
      {admin && (
        <div className="admin-controls" onClick={(e) => e.stopPropagation()}>
          <button className="mini-btn" onClick={() => onDownload(item)}>⬇ Descargar</button>
          <button className="mini-btn mini-danger" onClick={() => onDelete(item)}>Eliminar</button>
        </div>
      )}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div>♡</div>
      <h3>Aún no hay recuerdos</h3>
      <p>¡Sé el primero en compartir una foto o video!</p>
    </div>
  );
}

// Portada única: subir + fotos en vivo, sin navegar a otras vistas.
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
    setStatus({ msg: `Subiendo ${selectedFiles.length} archivo(s)...`, type: "" });
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
      setStatus({ msg: "¡Tus recuerdos fueron guardados correctamente! ♥", type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ msg: "No se pudo subir. Revisa tu conexión o el tamaño (máx 100 MB).", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="hero" style={{ padding: "45px 0 25px" }}>
        <div className="hero-badge">Nuestro día especial · 2026</div>
        <h1>Ayúdanos a guardar<br /><span>cada momento.</span></h1>
        <p>Sube tus fotos aquí y mira las de los demás al instante.</p>
      </div>

      <div className="upload-card">
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
          <div className="upload-cloud">☁</div>
          <h3>Arrastra tus archivos aquí</h3>
          <p>o <strong>haz clic para seleccionarlos</strong></p>
          <small>JPG, PNG, WEBP, MP4, MOV y otros formatos compatibles</small>
        </label>

        {!!selectedFiles.length && (
          <div className="selected-files">
            {selectedFiles.map((f) => (
              <div key={f.name + f.size} className="file-chip">✓ {f.name} · {formatBytes(f.size)}</div>
            ))}
          </div>
        )}

        <button className="primary-btn full" onClick={handleUpload} disabled={uploading}>
          Subir recuerdos ♥
        </button>
        <div className={`status ${status.type}`}>{status.msg}</div>
      </div>

      <div className="live-feed">
        <div className="live-feed-head">
          <div>
            <span className="eyebrow">EN VIVO</span>
            <h3>Fotos de los invitados {items.length > 0 && <span className="live-count">({items.length})</span>}</h3>
            <p>Aparecen aquí automáticamente cuando alguien sube.</p>
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="gallery-grid">
            {items.map((item) => (
              <MediaCard key={item._id} item={item} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
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
      <div className="admin-login">
        <div className="login-card">
          <div className="lock">🔐</div>
          <span className="eyebrow">ÁREA PRIVADA</span>
          <h2>Panel de administración</h2>
          <p>Ingresa para gestionar los recuerdos de la boda.</p>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") login(); }}
          />
          <button className="primary-btn full" onClick={login}>Entrar al panel</button>
          {error && <div className="error-msg">{error}</div>}
          <small className="demo-note">Demo: contraseña <b>admin123</b></small>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="admin-top">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h2>Recuerdos recibidos</h2>
        </div>
        <div className="admin-actions">
          <button
            className="primary-btn"
            onClick={() => {
              if (!items.length) { window.alert("No hay archivos para descargar."); return; }
              items.forEach((x, i) => setTimeout(() => downloadItem(x), i * 250));
            }}
          >
            ⬇ Descargar seleccionados
          </button>
          <button className="danger-btn" onClick={handleClearAll}>Eliminar todo</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat-card"><strong>{items.length}</strong><span>Archivos</span></div>
        <div className="stat-card"><strong>{photos}</strong><span>Fotos</span></div>
        <div className="stat-card"><strong>{videos}</strong><span>Videos</span></div>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre de archivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="ghost-btn"
          onClick={() => { setLogged(false); setPassword(""); }}
        >
          Cerrar sesión
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div>📂</div><h3>No hay archivos</h3><p>Los recuerdos que suban los invitados aparecerán aquí.</p>
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
    </>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [lightbox, setLightbox] = useState(null);
  const items = useQuery(api.memories.list) ?? [];

  function go(next) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      <header className="navbar">
        <a href="#" className="brand" onClick={(e) => { e.preventDefault(); go("home"); }}>
          <span className="brand-icon">♥</span>
          <span>Wedding Memories</span>
        </a>
        <nav>
          <button className={`nav-link${view === "home" ? " active" : ""}`} onClick={() => go("home")}>Inicio</button>
          <button className="admin-btn" onClick={() => go("admin")}>Admin</button>
        </nav>
      </header>

      <main>
        {view === "home" && (
          <section className="view active-view">
            <HomeView items={items} onOpen={setLightbox} />
          </section>
        )}

        {view === "admin" && (
          <section className="view active-view">
            <AdminView items={items} />
          </section>
        )}
      </main>

      {lightbox?.url && (
        <div className="lightbox" onClick={(e) => { if (e.target.classList.contains("lightbox")) setLightbox(null); }}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>×</button>
          <div>
            {isVideo(lightbox)
              ? <video src={lightbox.url} controls autoPlay />
              : <img src={lightbox.url} alt="" />}
          </div>
        </div>
      )}

      <footer>
        <span>Hecho con ♥ para un día inolvidable</span>
        <button onClick={() => go("admin")} className="footer-admin">Acceso administrador</button>
      </footer>
    </>
  );
}
