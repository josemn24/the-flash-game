# Esquemas declarativos

Los archivos SQL de esta carpeta son la fuente de verdad del esquema de PostgreSQL. Edita aquí el
estado deseado y genera después una migración con:

```bash
npx supabase db schema declarative sync --no-apply --name nombre_descriptivo
```

No edites la base de datos local directamente esperando que el sincronizador reconstruya el cambio.
Mantén los nombres de archivo en un orden lexicográfico que respete las dependencias entre objetos.

Todavía no hay definiciones SQL en este repositorio.
