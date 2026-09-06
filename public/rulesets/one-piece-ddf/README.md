# Dungeons and Devil Fruits — ruleset en JSON

Datos estructurados extraídos del *One Piece Dungeons and Devil Fruits Player's Handbook*
(v3.0.0, autor **oneworldhd**, 217 páginas,
[fuente](https://homebrewery.naturalcrit.com/share/ItlMSW6ztZTm)) para alimentar un creador
y hoja de personaje dentro del Quest App.

**Cobertura verificada: 100%** de los párrafos del manual están representados en estos archivos.
`build/verify.py` corre 0 fallas.

---

## Arquitectura: por qué está partido así

Hay dos capas y hacen cosas distintas:

| Capa | Archivos | Para qué |
|---|---|---|
| **Motor** | `core`, `races`, `classes`, `backgrounds`, `feats`, `haki`, `devil_fruits`, `weapons`, `armor`, `gear`, `spell_lists` | Datos con campos tipados. Es lo que el wizard consume para ofrecer opciones y lo que el motor usa para calcular. |
| **Referencia** | `reference.json` | El manual entero como árbol de 1.058 secciones con la prosa intacta. Es el visor de reglas: el jugador toca un feature y lee el texto original. Garantiza que nada se pierda al estructurar. |

El `rulesetId` es `one-piece-ddf`. **Nada aquí está cableado a One Piece a nivel de código**:
la app carga un ruleset por id, así que meter D&D 5e normal u otro homebrew después es
agregar una carpeta de JSON, no reescribir el motor.

---

## Archivos

### Motor
- **`core.json`** — identidad del sistema, las 6 habilidades, las 18 destrezas, tabla de
  modificadores (1→30), tabla de avance XP/nivel/bono de competencia (20 niveles), los 8 pasos
  de creación de personaje, y la lista completa de cambios respecto a 5e.
- **`races.json`** — 10 razas + 16 subrazas. Cada una con `abilityScoreIncrease` parseado,
  `speed` (walk/swim/fly), `size`, y sus rasgos como texto. Las subrazas humanas traen
  `replacesBaseAbilityScoreIncrease: true` porque reemplazan el bono base en vez de sumarse.
- **`classes.json`** — las 11 clases. Cada una con:
  - `progression`: 20 filas, cada una con `level`, `columns` (las columnas propias de la clase:
    Fury, Ki Points, Scrapper die, Unarmored Movement…), `features` y **`featureRefs`**, que
    enlaza cada nombre de la tabla con el id del texto correspondiente (resuelto al 100%,
    incluidos los typos del original como *Skalid Verse* → *Skaldic Verse*).
  - `features` con nivel y `options` anidadas (los Fury features del Bruiser, los Fighting
    Styles del Warrior, las sub-partes del spellcasting).
  - `subclasses` (38 en total) con sus features por nivel.
  - `extras`: Abominations del Chemist, Sea Devil's Emanations del Devilforged.
- **`backgrounds.json`** — 23, con competencias, equipo, feature propio y las 4 tablas d6
  (rasgos, ideales, vínculos, defectos) ya como arrays.
- **`feats.json`** — 50, con prerrequisito y ASI parseados.
- **`haki.json`** — los 3 colores con su habilidad de lanzamiento (Armamento→CON,
  Observación→SAB, Rey Supremo→CAR) y **73 advancements** clasificados por rareza.
- **`devil_fruits.json`** — 19 advancements de fruta, las guías de diseño paso a paso
  (Paramecia / Zoan / Logia), debilidades universales, awakening.
- **`devil_fruit_catalog.json`** — **224 frutas** de las tablas d100, cada una con tipo,
  rareza, significado y modelo. Sirve directo para un selector o un generador aleatorio.
- **`weapons.json`** (46), **`armor.json`** (13), **`gear.json`** (171),
  **`special_equipment.json`** (Dials, Pop Greens, Stars, Meito, Den Den Mushi, mercado negro),
  **`wealth_and_expenses.json`** (Belly, conversión, packs, herramientas, gastos de vida).
- **`spell_lists.json`** — listas por clase (chemist, devilforged, hybrid, marksman, priest,
  skald, tinkerer). **Solo nombres** — ver dependencias abajo.
- **`custom_spells.json`** — los 11 hechizos propios de este sistema, con texto completo.
- **`crew_roles.json`** (9), **`crew_meta.json`** (Pirate Prestige, facciones),
  **`character_dreams.json`** (20), **`multiclassing.json`**.

### Contratos
- **`character.schema.json`** — qué se guarda por personaje. Solo elecciones y estado vivo;
  nada derivado.
- **`derived_rules.json`** — las ~16 fórmulas que la app calcula al vuelo (PV máximos, CA,
  CD de salvación, Haki DC, features activos por nivel). Guardar cualquiera de estas en la
  base de datos es garantizar que se desincronice.
- **`manifest.json`** — versión, conteos, hashes y typos conocidos del original.

---

## Lo que hay que saber antes de construir

**1. Haki y Devil Fruits no dependen del nivel.** Es la diferencia estructural más grande
contra una hoja de 5e normal. El DM los otorga en *Spirit Surge Events*, y el CR del desafío
define la rareza máxima que el jugador puede elegir (Uncommon 1-4, Rare 5-10, Very Rare 11-17,
Legendary 18+). La hoja necesita **un libro mayor de concesiones separado de la progresión de
clase**, y el DM necesita poder otorgar desde su lado. Un wizard que solo mire `level` deja
fuera la mitad del sistema.

**2. La Unarmored Defense no se suma, se compara.** Bruiser es `10 + DES + CON`,
Martial Artist es `10 + DES + SAB`, el Soul Armor de Haki es `13 + CON`. La CA es el **mayor**
de las opciones disponibles, nunca la suma.

**3. La hoja de fruta es un objeto por personaje, no una fila de catálogo.** Dos jugadores con
la misma fruta pueden tener hojas distintas: el capítulo 7 es un *proceso de diseño* de 5 pasos,
no una lista cerrada. Por eso `devilFruit` en el esquema es un objeto editable con catalogId
opcional.

**4. Dependencias externas.** El capítulo 8 lista los hechizos **por nombre nada más** — el
texto no está en el manual. La app necesita una base de hechizos 5e aparte. El SRD 5.1 está
bajo CC-BY-4.0 y cubre buena parte, pero el manual también cita hechizos de Xanathar's y
Tasha's, que no son SRD. Y las reglas base (combate, descansos, condiciones) también vienen
de 5e; este manual solo documenta los cambios.

**5. Permisos.** Este manual es homebrew de fans con autor identificable (oneworldhd) y usa IP
de One Piece (Shueisha/Toei). Para un uso interno en tus mesas de Quest es una cosa; publicarlo
como feature de una plataforma comercial es otra. Conviene escribirle al autor antes de lanzar
— la mayoría de los autores de homebrew dicen que sí con crédito, y tenerlo por escrito te
cuesta un email.

---

## Regenerar

```bash
python3 build/clean.py        # limpia el markdown de Homebrewery
python3 build/x_core.py       # reglas base, tablas de modificadores y avance
python3 build/x_races.py      # razas y subrazas
python3 build/x_classes.py    # clases, progresión, features, subclases
python3 build/x_link.py       # enlaza tabla de progresión ↔ textos
python3 build/x_rest.py       # backgrounds, equipo, feats, haki, hechizos
python3 build/x_fruits.py     # catálogo de frutas y advancements
python3 build/x_reference.py  # árbol completo del manual
python3 build/x_manifest.py   # manifiesto + esquemas
python3 build/verify.py       # 0 fallas esperadas
```
