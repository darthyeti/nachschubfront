# Studie Raketenturm (Issue 96, Akte E-49)

Studie: `reference/studien/raketenturm.html` (Start mit `python3 -m http.server`, dann
`/reference/studien/raketenturm.html`). Modelle in `reference/studien/raketenturm-modell.js`.
Standbilder, SVG-Bögen und Zahlen: `node tests/tools/raketenturm-stills.mjs` (Chromium, deviceScaleFactor 2).

Seit #91 feuert der Belagerungsmörser eine dicke Rakete mit großem Einschlag, das Modell ist aber noch das
Mörserrohr auf 50 Grad. Tills Wunsch: ein Raketenwerfer mit zwei größeren Raketen, ähnlich dem heutigen
Mörser. Die Studie zeigt drei Entwürfe neben dem heutigen Modell, auf derselben Spezialbasis, in derselben
Größe (`specialScale('siegeMortar')`) und mit dem echten Effekt des Spiels.

## Die drei Entwürfe

| | Entwurf | Aufbau | Nachladen sichtbar |
|---|---|---|---|
| A | **Doppelrohr** | Keillafette von heute, darauf zwei geschlossene Startrohre (dicker als heute), die Sprengköpfe in der Leitfarbe stehen aus den Mündungen, Zielfernrohr auf dem Rücken | Der Kopf fährt aus dem leeren Rohr wieder heraus; die Lampe am Verschluss ist rot, solange geladen wird, dann in der Leitfarbe |
| B | **Startschienen** | Niedrige Lafette mit Panzerschild vorn und Kiste hinten, darauf zwei ganze Raketen mit Flossen offen auf zwei Schienen, hinten ein Strahlabweiser, Zielfernrohr an der linken Wange wie heute | Die neue Rakete steigt aus der Kiste die leere Schiene hinauf; Lampe wie bei A |
| C | **Ladearme** | Pfeiler mit Kopf, daran zwei getrennte Arme weit auseinander, je eine Rakete obenauf, Gegengewichte hinten, seitlich zwei offene Gestelle; Zielfernrohr auf dem Kopf | Der leere Arm nickt auf sein Gestell, nimmt die dort liegende Rakete und hebt sie wieder; die stärkste Bewegung der drei |

Gemeinsam: Die zwei Raketen gehen abwechselnd los, eine je Schuss (die Simulation bleibt bei einem Geschoss).
Die leere wird zwischen 20 und 70 % der Nachladezeit (3,2 s) geladen, die zweite wartet geladen. So stehen in
der Zielphase (die letzten 0,8 s) immer zwei Raketen bereit, und der nächste Schuss wartet nie auf den Lader.

## Was die Studie zeigt

- **Szene:** heute (vom Spiel selbst gezeichnet: `drawTowerSprite`, `towerFx.js`) und A, B, C nebeneinander,
  alle nach der Regel des Spiels (Zielen 0,8 s mit roter Linie vom Fernrohr und Zielring, Vorhalt, Flugzeit
  1,2 s, Nachladen 3,2 s). Rakete, Rauch, Einschlag, Druckring, Krater, Bodenlicht und Teilchen sind die
  Funktionen aus `src/render` (`drawBigRocket`, `bigRocketTrail`, `drawBigImpact`, `drawPressureRing`,
  `drawCrater`, `groundLight`, `stepWorldParticle`, `drawWorldParticle`) mit den Maßen aus `src/data/art.js`.
  Bilder `szene-1-zielen.png` bis `szene-5-nachladen.png`.
- **Richtungen:** jedes Modell in acht Richtungen (`richtungen.png`).
- **Nachladen:** die Folge vom Schuss bis zum Zielen (`nachladen.png`).
- **Silhouette:** Schattenriss auf der kleinsten Zoomstufe 0,5 in vier Richtungen, daneben der Raketenwerfer
  (Standardstellung Rang 3) (`silhouette.png`).
- **Teile:** jedes Modell ganz mit Ankerpunkten und jedes Teil einzeln (`teile.png`), dazu groß (`gross.png`).

## SVG-Bögen

`entwurf-A.svg`, `entwurf-B.svg`, `entwurf-C.svg`: je ein Symbol für **Sockel** (Drehkranz), **Gehäuse**
(Lafette), **Werfer** (schwenkbar), **Rakete links** und **Rakete rechts**, dazu Werfer und linke Rakete halb
geladen. Die Ankerpunkte stehen als eigene Gruppe `rt-<Entwurf>-anker` mit `data-anker` und `data-lokal`
(lx, ly in Feldern, z in px über der Dachplatte): Drehpunkt, Kipppunkt, Mündung und Düse je Rakete, Visier,
Lader je Rakete. Die Bögen sind aus dem Modell aufgezeichnet (`canvas-to-svg.mjs`), ein Blick, Weltpixel bei
Zoom 1. Nicht von Hand ändern.

## Zahlen

Mittel über 16 Richtungen, ruhend, beide Raketen geladen (`zahlen.json`).

| Modell | Körper | Flächen je Bild | fill/stroke je Bild (live) | Bildgröße bei Zoom 1 | eine Stufe bei dpr 2 | Spitze über Boden |
|---|---|---|---|---|---|---|
| heute | 19 | 115 | 301 | 44 x 62 | 53 KB | 81,5 px |
| A Doppelrohr | 32 | 191 | 471 | 51 x 68 | 68 KB | 84,1 px (+3 %) |
| B Startschienen | 37 | 206 | 531 | 45 x 57 | 50 KB | 77,9 px (−4 %) |
| C Ladearme | 43 | 193 | 456 | 50 x 63 | 62 KB | 83,0 px (+2 %) |

Ruhend kommt die Waffe im Spiel aus dem Stufen-Cache (ein `drawImage`), die Zahl der Flächen zählt nur, wenn
sie live gezeichnet wird. Alle drei bleiben unter der Grenze von 10 % über dem früheren Sprite.

## Abweichungen

- **SVG und drehbares Modell.** Der Auftrag verlangt Entwürfe als SVG mit Teilen und Ankerpunkten. Seit M9 sind
  aber alle Waffen im Spiel drehbare Modelle aus Körpern (`docs/ART.md`, „Drehbare Modelle“), kein SVG: Ein
  SVG kennt keine Normalen. Die Entwürfe sind deshalb Modelle (so, wie das Spiel sie bräuchte), und die SVGs
  sind aus ihnen aufgezeichnete Bögen in einer Richtung, mit denselben Teilen und Ankerpunkten.
- **Nachladen wird live.** Weil sich der Ladezustand nach jedem Schuss über 1,6 s ändert, bräuchten die
  Raketen (bei C auch der Arm) im Spiel eine eigene Live-Ebene über der Stufe, wie Ring und Kugel des
  Gewitterturms, sonst wird die ganze Waffe während des Nachladens live gezeichnet. Kosten dann etwa 470 bis
  530 Striche je Stellung und Bild statt eines `drawImage`, für rund die Hälfte der Zeit, in der sie feuert.
  Bei C ist das am teuersten, weil der Arm sich mitbewegt.
- **Was kopiert ist.** Mündungsblitz, Rückstrahl, Staub und Rauchsäule beim Abschuss sowie die rote Linie des
  Fernrohrs sind in `towerFx.js` nicht exportiert. Die Studie zeichnet sie für die Entwürfe mit denselben
  Zahlen nach, aus Mündung, Düse und Visier des jeweiligen Modells; der Rückstrahl kommt zusätzlich aus der
  Düse der abgefeuerten Rakete. Die Teilchen des Spiels benutzen `Math.random`, die Studie einen festen
  Zufall, damit Standbilder gleich bleiben.
- **Name:** Die Studie heißt „Raketenturm“ (Arbeitstitel aus #71), im Spiel bleibt es der „Belagerungsmörser“.
- **Unverändert:** Regel, Werte, Effekt aus #91, Spezialbasis. Nichts in `src/`.

## Offene Fragen an Till

1. Welcher Entwurf: A Doppelrohr, B Startschienen oder C Ladearme (oder eine Mischung, etwa die Schienen von B
   mit dem Nicken von C)?
2. Name: Soll „Belagerungsmörser“ bleiben oder „Raketenturm“ werden? (Nur die Frage; die Studie benennt nichts
   um.)
