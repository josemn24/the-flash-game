# ADR 0004: Puntuación autoritativa en servidor

- Estado: aceptado.
- Fecha: 2026-09-12.

## Contexto

El prototipo evalúa preguntas en el navegador y necesita recibir objetos que contienen soluciones.
En un entorno competitivo, el usuario puede inspeccionar o modificar esos datos, los tiempos y la
puntuación enviada.

## Decisión

El navegador solo recibe la representación pública necesaria para jugar. Las soluciones permanecen
en un límite privado y el servidor valida cada envío, calcula la corrección y concede la puntuación.
Los tiempos competitivos se basan en timestamps y deadlines del servidor.

El servidor puede devolver feedback inmediato, pero no tiene que revelar la solución completa
durante la ventana competitiva. Los puntos concedidos se persisten y no se recalculan automáticamente
si el algoritmo cambia en el futuro.

## Consecuencias

- Los tipos públicos de preguntas deben separarse de los tipos editoriales y de evaluación.
- El flujo de juego necesitará operaciones de servidor incluso si la interfaz continúa siendo una
  experiencia cliente fluida.
- Las tablas privadas no tendrán políticas de lectura directa para clientes autenticados.
- Los puntos, tiempos y estados calculados por el cliente se consideran no confiables.
