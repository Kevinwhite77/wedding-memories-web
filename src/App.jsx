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

// Enrutado mínimo: "/" es la galería de los invitados, "/admin" el panel.
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
    <button className="tile" onClick={() => onOpen(item)} aria-label="Ver en grande">
      {isVideo(item) ? (
        <>
          <video src={item.url} muted preload="metadata" />
          <span className="play" aria-hidden="true" />
        </>
      ) : (
        <img src={item.url} alt="" loading="lazy" />
      )}
    </button>
  );
}

function GuestView({ items, onOpen }) {
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const generateUploadUrl = useMutation(api.memories.generateUploadUrl);
  const saveMemory = useMutation(api.memories.save);

  // Sube en cuanto el invitado elige archivos: sin paso extra de "enviar".
  async function upload(list) {
    const files = list.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!files.length) {
      setStatus("Solo fotos o videos.");
      return;
    }
    setUploading(true);
    let done = 0;
    try {
      for (const file of files) {
        setStatus(`Subiendo ${done + 1} de ${files.length}…`);
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
        done += 1;
      }
      setStatus("¡Gracias! Ya está en la galería.");
    } catch (err) {
      console.error(err);
      setStatus(`No se pudo subir (${done} de ${files.length}). Máximo 100 MB por archivo.`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <section className="top">
        <h1>Kevin &amp; Cesia</h1>
        <div className="upload">
          <label className={`upload-btn${uploading ? " is-busy" : ""}`}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              disabled={uploading}
              className="visually-hidden"
              onChange={(e) => upload([...e.target.files])}
            />
            {uploading ? "Subiendo…" : "Subir fotos"}
          </label>
          {status && <p className="status" role="status">{status}</p>}
        </div>
      </section>

      <section className="gallery" aria-label="Galería">
        {items.length === 0 ? (
          <p className="empty">Aún no hay fotos. ¡Sube la primera!</p>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <Tile key={item._id} item={item} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AdminView({ items, onExit }) {
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
    if (!window.confirm(`¿Eliminar "${item.fileName || "este archivo"}"?`)) return;
    await removeMemory({ id: item._id });
  }

  async function handleClearAll() {
    if (!items.length) return;
    if (window.confirm(`¿Eliminar los ${items.length} archivos? No se puede deshacer.`)) {
      await clearAll({});
    }
  }

  if (!logged) {
    return (
      <section className="login">
        <h1>Administración</h1>
        <form onSubmit={(e) => { e.preventDefault(); login(); }}>
          <input
            type="password"
            aria-label="Contraseña"
            placeholder="Contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="upload-btn" type="submit">Entrar</button>
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
          <p className="summary">{items.length} en total · {photos} fotos · {videos} videos</p>
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
          placeholder="Buscar por nombre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="text-btn" onClick={onExit}>Volver a la galería</button>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">{items.length ? "Ningún archivo coincide." : "Aún no llegan archivos."}</p>
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
      <main>
        {isAdmin
          ? <AdminView items={items} onExit={() => navigate("/")} />
          : <GuestView items={items} onOpen={setLightbox} />}
      </main>

      {!isAdmin && (
        <footer>
          <a href="/admin" onClick={(e) => { e.preventDefault(); navigate("/admin"); }}>Administración</a>
        </footer>
      )}

      {lightbox?.url && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}
        >
          <button className="lightbox-close" onClick={() => setLightbox(null)}>Cerrar</button>
          {isVideo(lightbox)
            ? <video src={lightbox.url} controls autoPlay />
            : <img src={lightbox.url} alt="" />}
        </div>
      )}
    </>
  );
}
