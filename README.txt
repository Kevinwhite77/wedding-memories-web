# Wedding Memories — Galería de boda

## Cómo probarla
1. Abre `index.html` en Chrome, Edge o Firefox.
2. Entra en "Compartir recuerdos" y selecciona fotos/videos.
3. Los archivos quedan guardados en el almacenamiento local del navegador.
4. Entra a `/admin` (o al enlace "Administración" del pie de página).
5. Contraseña de demostración: `cielosazules`.

## Importante para una versión real
Esta versión es un prototipo frontend. `localStorage` sirve para demostrar el funcionamiento en un solo navegador, pero NO permite que los invitados de distintos celulares compartan archivos en una galería común.

Para ponerla en producción se necesita:
- Backend/API para recibir los archivos.
- Base de datos para usuarios/metadatos.
- Almacenamiento de archivos (por ejemplo, un bucket).
- Autenticación real para el administrador.
- Límites de tamaño y validación de archivos.
- HTTPS.
- Opcional: generación de QR para compartir el enlace de la boda.

La interfaz ya está separada en HTML, CSS y JavaScript para poder conectar ese backend posteriormente.
