// Pantalla que muestra el service worker cuando no hay internet.
// Tiene sus estilos adentro a proposito: sin conexion no se pueden cargar
// los archivos de estilos de la app, y esta pantalla tiene que verse bien igual.

const css = `
.offline-wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: #f3f3f4;
  color: #151518;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.offline-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 5rem 1.5rem 2.5rem;
  background-color: #8b2332;
  background-image: repeating-linear-gradient(
    180deg, transparent 0 14px, rgba(255, 255, 255, 0.14) 14px 16px
  );
  color: #ffffff;
}
.offline-hero h1 {
  margin: 0;
  font-family: 'Arial Narrow', Impact, system-ui, sans-serif;
  font-size: 3.5rem;
  line-height: 1;
  font-weight: 700;
}
.offline-hero p { margin: 0.75rem 0 0; font-size: 1.1rem; max-width: 20rem; }
.offline-body { padding: 2rem 1.5rem 2.5rem; max-width: 28rem; width: 100%; margin: 0 auto; box-sizing: border-box; }
.offline-body p { margin: 0 0 1.25rem; line-height: 1.5; color: #55555f; }
.offline-btn {
  display: block;
  text-align: center;
  padding: 0.95rem 1rem;
  border-radius: 0.75rem;
  background: #8b2332;
  color: #ffffff;
  font-weight: 600;
  font-size: 1.05rem;
  text-decoration: none;
}
@media (prefers-color-scheme: dark) {
  .offline-wrap { background: #000000; color: #f4f4f5; }
  .offline-hero { background-color: #a22a3b; }
  .offline-body p { color: #a1a1aa; }
  .offline-btn { background: #a22a3b; }
}
`

export default function OfflinePage() {
  return (
    <div className="offline-wrap">
      <style>{css}</style>

      <header className="offline-hero">
        <h1>Sin conexión</h1>
        <p>No hay internet en este momento.</p>
      </header>

      <div className="offline-body">
        <p>
          Tus datos están guardados y a salvo. Cuando vuelva la conexión, podés seguir
          registrando tus entrenamientos como siempre.
        </p>
        {/* Un enlace comun y no un boton con JavaScript: funciona aunque los scripts no carguen */}
        <a className="offline-btn" href="/">
          Reintentar
        </a>
      </div>
    </div>
  )
}
