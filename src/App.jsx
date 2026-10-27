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
  return new Date(ts).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

// Enrutado mínimo: "/" es la noche de los invitados, "/admin" el panel.
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

function Tile({ item, onOpen }) {
  if (!item.url) return null;
  return (
    <button className="tile" onClick={() => onOpen(item)} aria-label={`Ver ${item.fileName || "recuerdo"}`}>
      {isVideo(item) ? (
        <video src={item.url} muted preload="metadata" />
      ) : (
        <img src={item.url} alt="" loading="lazy" />
      )}
      {isVideo(item) && <span className="play" aria-hidden="true" />}
    </button>
  );
}

function GuestView({ items, onOpen }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState({ msg: "", type: "" });
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const generateUploadUrl = useMutation(api.memories.generateUploadUrl);
  const saveMemory = useMutation(api.memories.save);

  function pick(list) {
    const valid = list.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setFiles(valid);
    setStatus(
      list.length && !valid.length
        ? { msg: "Solo aceptamos fotos y videos.", type: "error" }
        : { msg: "", type: "" }
    );
  }

  async function send() {
    if (!files.length) {
      setStatus({ msg: "Elige al menos una foto o video.", type: "error" });
      return;
    }
    setUploading(true);
    setStatus({ msg: `Enviando ${files.length} ${files.length === 1 ? "archivo" : "archivos"}…`, type: "" });
    try {
      for (const file of files) {
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
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      setStatus({ msg: "Listo. Ya aparecen en la galería.", type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ msg: "No se pudo enviar. Revisa tu conexión e intenta otra vez. Máximo 100 MB por archivo.", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <section className="hero">
        <h1>
          <span>Las fotos</span>
          <span>que nos faltaban.</span>
        </h1>
        <div className="hero-foot">
          <p>Sube lo que captaste esta noche. Cada archivo aparece en la galería al instante.</p>
          <label
            className={`shutter${dragging ? " is-dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick([...e.dataTransfer.files]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="visually-hidden"
              onChange={(e) => pick([...e.target.files])}
            />
            <span className="shutter-core">
              {files.length ? files.length : "Elegir"}
            </span>
            <span className="visually-hidden">Elegir fotos y videos</span>
          </label>
        </div>
      </section>

      <section className="upload" aria-label="Enviar recuerdos">
        {!!files.length && (
          <ul className="queue">
            {files.map((f) => (
              <li key={f.name + f.size}>
                <span className="queue-name">{f.name}</span>
                <span className="queue-size">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="send-row">
          <button className="send" onClick={send} disabled={uploading || !files.length}>
            {uploading ? "Enviando…" : "Enviar recuerdos"}
          </button>
          <p className={`status ${status.type}`} role="status">{status.msg}</p>
        </div>
      </section>

      <section className="gallery" aria-labelledby="gallery-title">
        <div className="gallery-head">
          <h2 id="gallery-title">Lo que han compartido</h2>
          {items.length > 0 && <span className="count">{items.length} {items.length === 1 ? "archivo" : "archivos"}</span>}
        </div>
        {items.length === 0 ? (
          <p className="empty">Todavía no hay nada aquí. La primera foto puede ser tuya.</p>
        ) : (
          <div className="mosaic">
            {items.map((item) => (
              <Tile key={item._id} item={item} onOpen={onOpen} />
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

  const videos = items.filter(isVideo).length;
  const photos = items.length - videos;

  function login() {
    if (password === ADMIN_PASSWORD) {
      setLogged(true);
      setError("");
    } else {
      setError("La contraseña no coincide.");
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
    if (!window.confirm(`¿Eliminar "${item.fileName || "este archivo"}"?`)) return;
    await removeMemory({ id: item._id });
  }

  async function handleClearAll() {
    if (!items.length) return;
    if (window.confirm("¿Eliminar los " + items.length + " archivos? Esta acción no se puede deshacer.")) {
      await clearAll({});
    }
  }

  if (!logged) {
    return (
      <section className="login">
        <h1>Administración</h1>
        <p>Ingresa la contraseña para revisar y descargar los archivos.</p>
        <form onSubmit={(e) => { e.preventDefault(); login(); }}>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="send" type="submit">Entrar</button>
          {error && <p className="status error" role="alert">{error}</p>}
        </form>
      </section>
    );
  }

  return (
    <section className="admin">
      <div className="admin-head">
        <div>
          <h1>Archivos recibidos</h1>
          <p className="summary">
            {items.length} en total · {photos} {photos === 1 ? "foto" : "fotos"} · {videos} {videos === 1 ? "video" : "videos"}
          </p>
        </div>
        <div className="admin-actions">
          <button
            className="text-btn"
            onClick={() => {
              if (!items.length) { window.alert("No hay archivos para descargar."); return; }
              items.forEach((x, i) => setTimeout(() => downloadItem(x), i * 250));
            }}
          >
            Descargar todo
          </button>
          <button className="text-btn danger" onClick={handleClearAll}>Eliminar todo</button>
        </div>
      </div>

      <div className="admin-tools">
        <input
          type="search"
          aria-label="Buscar por nombre"
          placeholder="Buscar por nombre de archivo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="text-btn" onClick={() => { setLogged(false); setPassword(""); }}>Salir</button>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">{items.length ? "Ningún archivo coincide con la búsqueda." : "Aún no llegan archivos."}</p>
      ) : (
        <table className="files">
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">Vista previa</span></th>
              <th scope="col">Nombre</th>
              <th scope="col">Subido</th>
              <th scope="col">Tamaño</th>
              <th scope="col"><span className="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item._id}>
                <td className="thumb-cell">
                  {item.url && (isVideo(item)
                    ? <video src={item.url} muted preload="metadata" />
                    : <img src={item.url} alt="" loading="lazy" />)}
                </td>
                <td className="name-cell">{item.fileName || "Sin nombre"}</td>
                <td>{formatDate(item._creationTime)}</td>
                <td>{formatBytes(item.size)}</td>
                <td className="row-actions">
                  <button className="text-btn" onClick={() => downloadItem(item)}>Descargar</button>
                  <button className="text-btn danger" onClick={() => deleteItem(item)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function App() {
  const [path, navigate] = usePath();
  const [lightbox, setLightbox] = useState(null);
  const items = useQuery(api.memories.list) ?? [];
  const isAdmin = path === "/admin";

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <>
      <header className="top">
        <a href="/" className="wordmark" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          Recuerdos de la boda
        </a>
        <nav>
          {isAdmin ? (
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Ver la galería</a>
          ) : (
            <a href="/admin" onClick={(e) => { e.preventDefault(); navigate("/admin"); }}>Administración</a>
          )}
        </nav>
      </header>

      <main>
        {isAdmin ? <AdminView items={items} /> : <GuestView items={items} onOpen={setLightbox} />}
      </main>

      {lightbox?.url && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
        >
          <button className="lightbox-close" aria-label="Cerrar" onClick={() => setLightbox(null)}>Cerrar</button>
          {isVideo(lightbox)
            ? <video src={lightbox.url} controls autoPlay />
            : <img src={lightbox.url} alt="" />}
        </div>
      )}
    </>
  );
}
