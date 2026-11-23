# 00_STATE — RESONANCE

Última actualización: 2026-11-22.
Leer primero. Después solo los docs que indique el workstream (ver 02_ROADMAP.md en el Project).

## Estado actual
- Workstream activo: **W5 progresión y builder — entregado, pendiente de que el dueño lo pruebe.**
- W2 / W2b (gray-box + silencios): cerrados. w2-v9 commiteado.
- W3 (kit de naves en Blender): cerrado y subido al repo (ships_manifest.json, GLB HD+lite de GEMINI/HALO/PETAL).
- W4 (kit de entorno en Blender): cerrado y subido al repo (env_manifest.json, GLB HD+lite de ruta y set pieces).
- Schemas congelados como v1 (04_TECH_SPEC.md). W5 no cambió el schema de cue map ni de save; el save v1 ya estaba
  definido en el tech spec y ahora tiene una implementación real (antes era solo el schema en el doc).

## Qué contiene w5-v1 (build actual)
Todo lo de w2-v9 (gray-box 2D, carril vertical, escalera de estímulo, flips en silencios, cinemática D-20) más:
- **`core/progression.js` (nuevo):** único lugar que lee/escribe el save v1. Expone:
  - `defaultSave()` / `loadSave()` / `saveSave()`: localStorage, con `migrate()` para rellenar canciones o upgrades
    que una save vieja no tenga, sin tocar lo que ya tiene.
  - `exportCode()` / `importCode()`: código base64 copiable (sin cuenta ni servidor).
  - 5 upgrades (Span, Agility, Echo, Magnet, Gain), niveles 0-5, costo creciente por nivel (`upgradeCost`, mismo
    curva para los 5, [TUNE]). Ninguno toca la velocidad de la nave (P-07): Span agranda la ventana del ring,
    Agility agranda las ventanas de pulso, Echo da "shield charges" que salvan una frase de quedar hollow (nuevo
    mecanismo en core.js, ver abajo), Magnet reduce la distancia efectiva a un ring, Gain multiplica la Energy.
  - Cadena de desbloqueo: Full Resonance en una canción desbloquea la siguiente (orden: Cry Me A Reverb → Nueva
    Anormalidad → Ganimedes, Q-03) y otorga un juego de piezas cosmético completo **[PROPUESTO, a confirmar con
    el dueño]**: Full en la canción 0 da HALO, Full en la canción 1 da PETAL. GEMINI se posee desde el arranque
    (nave base de W3). Ningún ship cambia stats (w3-handoff).
  - Ghost: `compactGhost()` reduce la ruta (t,x) de una corrida a ≤300 puntos antes de guardarla; `ghostX()` la
    interpola para el replay. Se guarda solo si la corrida mejora el mejor `heardFrac` de esa canción.
- **`core.js` (cambio mínimo, compatible):** nuevo soporte para `opt.shields` (Echo) y `opt.magnet`, y `opt.perfect`/
  `opt.good` ahora configurables (antes fijos). Con los valores por defecto (0 shields, 0 magnet, mismos perfect/good
  de antes) el comportamiento es *idéntico* al de w2-v9 — `core/test_bot.js` pasa sin cambios.
- **`index.html`:** pantallas nuevas Upgrades, Ship builder y Save (export/import), barra de Energy + canciones
  bloqueadas/desbloqueadas en el menú, Latency persistida en el save, nave fantasma (ghost) semi-transparente en
  pista con "ghost Δx" en el HUD, pantalla de resultados con Energy ganada y mensajes de desbloqueo.
  **El ship builder es solo el modelo de datos (qué parte vas a equipar por slot) — el gray-box en Canvas 2D sigue
  dibujando la nave genérica de siempre; todavía no integra los GLB de W3/W4.** Eso sigue sin asignar a ningún
  workstream (ver Pendiente).
- **`scripts/sim_progression.js` (nuevo, gate del roadmap):** corre un bot de skill fijo que gasta la Energy ganada
  en upgrades entre corrida y corrida, y mide cuántas corridas hacen falta para Full Resonance por canción/tier/
  perfil. Resultado actual: perfiles "skilled"/"average"/"rough" (skill .97/.75/.55) llegan a Full Resonance en
  **9 corridas o menos** en cualquier canción y dificultad → dentro de "a handful of runs" (Game Sheet §8). Un
  perfil "struggling" (skill .35, solo de robustez, no es el objetivo de tuneo) puede no llegar a Full ni con todos
  los upgrades al máximo en la canción más corta/dispersa (easy) — es un piso de dificultad aceptado, no un bug.
- **`core/test_progression.js` (nuevo):** 29 checks unitarios de progression.js (save, export/import, migrate,
  compra de upgrades, desbloqueo + recompensa cosmética, ghost, equip).
- Probado con Playwright (Chromium headless, software WebGL) en desktop 1280×720, portrait 430×932 y landscape
  932×430: menú, Upgrades, Ship builder, Save, una corrida completa de punta a punta (bot perfecto → Full
  Resonance → Energy otorgada → desbloqueo de canción + nave → ghost guardado), una segunda corrida sin repetir
  mensajes de desbloqueo. Sin errores de consola (aparte de los 404 de mp3 esperables en un harness de prueba sin
  los audios reales) ni banner de error. Capturas revisadas a mano, sin cortes de layout.
- **No probado:** la pantalla de juego real con los mp3 reales (sí se probó el *fallback* de audio-no-disponible,
  que es lo que corre en el harness de test); el teléfono real; el flujo completo de latencia/calibración con
  audio real; el ghost visualmente en una corrida jugada a mano (sí se probó mecánicamente vía test).

## Pendiente
1. Que el dueño pruebe w5-v1 (desktop y teléfono si puede) y confirme o ajuste lo propuesto: curva de costo de
   upgrades, bonus de Full/Pure, y sobre todo el **reparto de recompensa cosmética** (HALO tras canción 0, PETAL
   tras canción 1) — es una decisión mía, no suya, así que puede querer otra cosa (por ejemplo ligarlo a Pure en
   vez de Full, o a un umbral de Energy en vez de a las canciones).
2. Integrar los GLB de naves y entorno (W3/W4) al juego real en Three.js — sigue sin asignar a ningún workstream;
   el ship builder de W5 ya tiene el modelo de datos listo para cuando se haga (`save.parts.equipped`).
3. Preview de audio en el menú (hover/tap sobre una canción bloqueada muestra teaser hollow) — mencionado en el
   Game Sheet como PROPUESTO pero nunca construido; no es parte del gate de W5.
4. Selector de idioma (inglés/español) — el campo `save.lang` existe y sobrevive a `migrate()`, pero no hay UI ni
   traducción de los textos todavía (Game Sheet §11, no es parte del gate de W5).
5. Opcional / no bloqueante (heredado de W3/W4): revisar la silueta de la criatura de luz; texturas de librea
   definitivas para el kit de entorno; variantes extra de ruta.
6. Confirmar en algún momento si el repo vivo sigue siendo `crudeza/Rationalism/resonance/` (Q-05) — en esta sesión
   el conector de GitHub sí pudo leer y listar este repo (a diferencia de intentos previos que dieron 404), así que
   parece ser el correcto; no se verificó nada más allá de eso.

## Registro de cambios
(histórico anterior a W5: ver versiones previas de este archivo / handoffs de W3 y W4 en memoria del Project)
- 2026-11-22: **W5 (progresión y builder)** — `core/progression.js` (save v1 real, upgrades, cadena de
  desbloqueo, ghost), cambio mínimo y compatible en `core.js` (shields/magnet/forgiveness configurables),
  pantallas de Upgrades/Ship builder/Save en `index.html`, `scripts/sim_progression.js` como gate de la curva de
  grind (9 corridas o menos), `core/test_progression.js` (29 checks). Probado con Playwright headless en 3
  viewports. Subido al repo por Claude (conector de GitHub con acceso de escritura confirmado en esta sesión).

## Próximo paso
Que el dueño juegue w5-v1, revise las pantallas nuevas (Upgrades, Ship, Save) y diga si el reparto de recompensas
cosmético y la curva de upgrades le cierran, o si prefiere otra cosa. Después: decidir en qué workstream entra la
integración 3D de W3/W4, o seguir con W6 (perfil mobile) / W7 (QA y entrega).

## Chat opener
"Leé 00_STATE.md. Estamos en [workstream]. Seguí las instrucciones del Project."
