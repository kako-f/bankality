# Bankality

Dashboard local de movimientos bancarios BCI. El navegador se conecta sólo al
servidor Django local; las cartolas se procesan y se descartan al importarse.

Los archivos reales, la base SQLite y la semilla inicial pertenecen a cada
equipo y están excluidos de Git.

## Desarrollo local

Requiere Python con las dependencias de `requirements.txt`, Node, NPM y
`pdftotext` instalado.

```bash
cd server
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

En otra terminal:

```bash
cd dashboard
npm install
npm run dev
```

Abre la URL de Vite, selecciona `Importar` y carga cartolas BCI `.pdf` o
`.xls`. Los archivos se procesan localmente y no se almacenan.
