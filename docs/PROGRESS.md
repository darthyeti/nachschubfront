# Fortschritt

## Aktueller Meilenstein
M3 ist umgesetzt und wartet auf die Abnahme. M1 und M1b sind abgenommen (22.09.2026), M2 ist umgesetzt und wurde mit der Freigabe des M3-Plans fortgeführt.

Reihenfolge: M1 → M1b → M2 → M3 → M4 → M5 → M6

## Erledigt
- Game-Design-Grundlagen (docs/GDD.md)
- Stiltest (reference/stiltest.html)
- M0 Projektgerüst, abgenommen am 22.09.2026. Läuft unter https://darthyeti.github.io/nachschubfront/.
- M1 Spielkern (22.09.2026, auf dem iPad abgenommen):
  - Wegfindung (`src/sim/pathfinding.js`): A* in acht Richtungen, gerade Schritte kosten 1, diagonale √2, kein Eckenschneiden, feste Reihenfolge bei Gleichstand (gleiche Karte, gleicher Weg).
  - Route (`src/sim/route.js`): Kette Riss → 1 → 2 → 3 → 4 → Bastion. Die Blockadeprüfung für ein Feld braucht etwa 0,15 ms. Flieger fliegen gerade von Punkt zu Punkt.
  - Kartengenerator (`src/sim/mapgen.js`, Werte in `src/data/map.js`): 24 × 24, Riss und Bastion an gegenüberliegenden Kanten, ein Signalfeuer pro Viertel, 12 bis 20 Ruinen, Krater und Mauerreste, geschützte Ringe. Über 500 Seeds geprüft.
  - Kamera (`src/render/camera.js`): Startansicht mit der ganzen Karte, Felder mindestens 40 px breit. Zoom um den Zeiger oder die Fingermitte, Begrenzung auf die Karte.
  - Eingabe (`src/input/`): Gestenerkennung ohne DOM mit Unit-Tests. Tippen und Ziehen werden über 8 px Schwelle unterschieden, dazu langes Drücken (für M3 vorbereitet), Pinch, Mausrad und Trackpad-Pinch, Pfeiltasten und Tastenkürzel.
  - Phasenautomat (`src/core/phases.js`): Planung → Salve → Auswahl → Welle → Auswertung → Planung, dazu Niederlage und Sieg. Salve und Auswahl liefen in M1 noch ohne Inhalt durch.
  - Gegner laufen die bei Wellenstart festgeschriebene Route. Durchbrüche kosten Leben, bei 0 Leben ist die Partie verloren.
  - Fünf Testwellen in `src/data/waves.js`, Gegnertabelle aus dem GDD in `src/data/enemies.js`, Regeln in `src/data/rules.js`.
  - Platzhaltergrafik im Stil des Stiltests: Boden im Offscreen-Cache, Riss, Signalfeuer, Bastion, Ruinen, Krater, Mauern, Trümmer und vier Gegnerformen. Die Routenvorschau ist eine laufende gestrichelte Linie, bei `prefers-reduced-motion` steht sie still.
  - HUD: Welle, Leben, Phase, Routenlänge, Seed, Pause/1x/2x/3x, „Welle starten“, „Neue Partie“, Banner nach Wellen und bei Niederlage oder Sieg.
  - Debug-Werkzeug: Taste `H` oder mit `?debug` der Hindernis-Modus. Abgelehnte Felder blinken rot mit Grund.
  - Tests: 91 Unit-Tests. Dazu `npm run test:input` mit 13 Prüfungen im Browser (Touch-Wischen, Tippen, Pinch, Maus, Tastatur, Welle auf 3x, Niederlage und neue Partie).
- M1b Grafik-Pipeline (22.09.2026, auf dem iPad abgenommen: Belastungstest mit 200 Gegnern läuft dort mit 60 fps):
  - Import (`npm run sprites`, `tests/tools/import-sprites.mjs`): Die Konzept-SVGs werden zusammengeführt, jede Figur wird im Browser vermessen. Das Ergebnis liegt als Module in `src/render/sprites/enemies.js` und `towers.js`. Welche Figur zu welchem Typ gehört und in welcher Größe, steht in `src/render/sprites/manifest.js`.
  - Rasterizer (`src/render/sprites/rasterizer.js`): Jede Figur wird einmal pro Stufe gerastert (0,5 / 1 / 2 / 2,5 mal DPR), mit vorgerenderter heller Treffer-Variante. Fehlende Stufen entstehen im Hintergrund, bis dahin wird die nächste vorhandene Stufe skaliert. Eine Ladeanzeige läuft beim Start.
  - Gegner aus den Sprites: Schatten, Wippen, Spiegeln je nach Laufrichtung mit Totzone. Flieger schweben über ihrem Schatten.
  - Stellungen: Sockel, Waffe, ab Veteran Sandsackring, Winkel für den Rang auf der linken Sockelseite (Legende in Gold). Im Spiel kommen sie erst mit M2 vor, zu sehen sind sie in der Sprite-Galerie `tests/sprites.html`.
  - Debug: Umschalter Sprites/Platzhalter (`G`, Knopf, `?art=placeholder`), Belastungstest mit 200 Gegnern, Rechenzeit pro Frame in der Debug-Anzeige.
  - Leistung (Playwright, Apple M2 mit GPU): 200 Gegner bei Start- und Maximalzoom konstant 60 fps, reine Rechenzeit 0,6 bis 1,3 ms pro Frame, im Betrieb 0 Rasterungen (`npm run test:perf`).
  - Tests: 100 Unit-Tests. Dazu 17 Eingabeprüfungen im Browser, jetzt auch Sprite-Galerie, Grafik-Umschalter und Leertaste nach Knopfklick.
  - WebKit (Safari-Engine) über Playwright: Alle 17 Eingabeprüfungen bestehen, alle Sprites werden fehlerfrei gerastert und sind bei maximalem Zoom scharf. Die Leistungsmessung mit 200 Gegnern ergibt etwa 17 ms pro Frame (WebKit rundet auf ganze Millisekunden), die Rechenzeit liegt bei 1,4 ms. `npm run test:webkit` führt alles aus.
  - Behobener iPad-Fehler, gefunden mit WebKit: HUD-Knöpfe reagierten nicht auf Touch. Ursache war `preventDefault()` auf `pointerdown` der Knöpfe; WebKit löst danach kein `click` aus. Jetzt geben die Knöpfe nach dem Klick den Fokus ab, damit die Leertaste weiter pausiert.

- M2 Kapselmechanik (22.09.2026, Abnahme offen):
  - Datentabellen aus dem GDD: Doktrinen mit Kampfwerten und Leitfarben (`src/data/doctrines.js`), Ränge (`ranks.js`), Nachschubstufen (`supply.js`), Rezepte (`recipes.js`), Kapselzeiten (`pods.js`). Das Sprite-Manifest bezieht Farben und Rangzahl von dort, damit die Tabellen nicht auseinanderlaufen.
  - Landezonen (`src/sim/zones.js`): bis zu fünf Markierungen, Tippen setzt und löscht, ungültige Felder blinken rot mit Grund. Geprüft wird immer die ganze Menge, nicht das einzelne Feld, darum kann eine Salve den Weg nie schließen. Fehlende Zonen ergänzt „Salve anfordern“ aus einer geseedeten Mischung aller Felder, bevorzugt mit zwei Feldern Abstand.
  - Routenvorschau: Sobald eine Zone markiert ist, zeigt die gestrichelte Linie den Weg, den die Gegner nach der Salve nehmen werden (`zonePreview`), und die Längenangabe im HUD gehört dazu. Die echte Route ändert sich erst beim Einschlag.
  - Kapseln (`src/sim/pods.js`): Inhalt aus Doktrin und Rang nach Nachschubstufe. Der Zufallsstrom hängt nur an Seed und Wellennummer (`fork('pods').fork(welle)`), also ändern weder Markierungen noch frühere Entscheidungen den Inhalt. Die Kapseln schlagen gestaffelt ein und blockieren ihr Feld beim Aufschlag.
  - Auswahl (`src/sim/selection.js`): Behalten, Verschmelzen von zwei oder vier gleichen, Rezept erfüllen. Das Ergebnis steht auf dem Feld der gewählten Kapsel, alle übrigen Kapseln werden zu Trümmern. Jede Salve hinterlässt damit genau eine Stellung und vier Trümmer.
  - Auswahldialog (`src/ui/selection.js`): fünf Kapselkarten mit Leitfarbe, Name, Rang und einem Abzeichen, wenn mehr als Behalten möglich ist. Darunter die Aktionen für die gewählte Kapsel. Auswahl per Karte oder durch Antippen der Kapsel auf der Karte, erkennbar am goldenen Ring.
  - Nachschlagewerk (`src/ui/codex.js`): alle sechs Rezepte mit Zutaten, Mindestrang und Wirkung. Knopf „Rezepte“, Taste `R`, schließt mit Escape oder Tippen daneben.
  - Kapselgrafik nach Stiltest (`src/render/pods.js`): Zielmarkierung, Sturz mit Glutschweif und Bremsflamme, Aufschlag, öffnende Luken, Hologramm mit Leitfarbe und Rang-Winkeln. Eine Salve dauert bei 1x etwa 3,2 Sekunden (`SALVO_SECONDS` in `src/data/pods.js`), bei 3x gut eine Sekunde.
  - HUD: „Salve anfordern“ statt „Welle starten“, Zonenzähler, Nachschubstufe. Die untere Leiste ist jetzt eine Spalte, damit der Auswahldialog sie nie überdeckt.
  - Debug: Nachschubstufe umschalten (`N` oder `?supply=`), Belastungstest zeichnet zusätzlich 40 Stellungen aller Doktrinen und Ränge.
  - Leistung (Playwright, Apple M2 mit GPU): 200 Gegner und 40 Stellungen bei Start- und Maximalzoom konstant 60 fps, Rechenzeit 1,3 bis 1,6 ms pro Frame, 0 Rasterungen im Betrieb. WebKit: 17 ms pro Frame, Rechenzeit 2,0 bis 2,3 ms.
  - Tests: 136 Unit-Tests (dazu Tabellen, Zonen, Kapselinhalte, Verschmelzen, Rezepte, eine ganze Partie mit Prüfung der Invarianten und der Wiederholbarkeit) und 21 Eingabeprüfungen im Browser, in Chromium und WebKit.
  - Behobener Fehler aus M1b: In `main.js` lag ein doppelter Block in `frame()`, der pro Bild einen Ladebildschirm anlegte und `sprites.preload()` aufrief. Gemessen nach zwei Sekunden: vorher 18 Überlagerungen über dem Canvas, jetzt 0.

- M3 Kampf und Inhalte (22.09.2026, Abnahme offen):
  - Datentabellen: Schadensmatrix und Rüstungsarten (`src/data/combat.js`), Gegner mit Sonderfähigkeiten und die fünf Bosse (`enemies.js`), Wirtschaft (`economy.js`), Spezialkommandos (`commands.js`), Werte der Spezialstellungen (`specials.js`).
  - Wellenliste: alle 50 Wellen ausgeschrieben in `src/data/waves.js`, erzeugt mit `npm run waves` aus den Regeln des GDD (Fünferzyklus, jede zehnte Welle Boss mit Begleitung, Leben mal 1,12 hoch Welle minus eins). Handänderungen in der Datei überschreibt der nächste Lauf; für M6 ändert man die Regeln im Werkzeug.
  - Kampfkern (`src/sim/combat.js`, `targeting.js`, `damage.js`): Ziel ist der Gegner, der den größten Teil seiner Route hinter sich hat, bei Gleichstand die kleinere ID. Der Anteil statt der reinen Strecke, weil Flieger eine kürzere Luftlinie fliegen und sonst nie an die Reihe kämen. Nachladen, Schadensmatrix, Warp-Schild vor dem Fleisch darunter, Belohnung pro Abschuss, Schadenszähler pro Stellung für die Wellenstatistik.
  - Doktrinen: Flamme brennt einen Kegel und setzt in Brand, Autokanone einzeln, Laser durchschlägt die Linie, Mörser führt sein Ziel vor und braucht eine Sekunde Flugzeit, Psi schädigt und verlangsamt im Ring, Tesla springt über vier Ziele mit minus 20 % je Sprung. Dazu Statuseffekte (Brand, Verlangsamung, Betäubung) in `effects.js` und Geschosse in `projectiles.js`.
  - Spezialstellungen: alle sechs Rezepte wirken (`src/data/specials.js`). Jede behält die Doktrin ihrer ersten Zutat, die über Schadensmatrix und Leitfarbe entscheidet.
  - Gegner: Heiler heilen 8/s im Radius 1,5, Zerplatzer setzen vier Schwärmer frei, Warp-Schilde regenerieren nach zwei ruhigen Sekunden. Bosse: Brutmutter setzt unterwegs Schwärmer frei, Warp-Herold springt drei Felder vor, Dämonenprinz wechselt alle vier Sekunden die Rüstungsart.
  - Wirtschaft (`src/sim/economy.js`): Requisition aus Abschüssen und Wellenbonus (10 plus Wellennummer), Kommandopunkte aus Bossen und durchbruchsfreien Wellen. Ausgeben: Nachschubstufe ausbauen und Trümmer abreißen (15, danach je 5 mehr), beides mit Preis auf dem Knopf.
  - Spezialkommandos (`src/sim/commands.js`, `src/ui/commands.js`): Orbitalschlag, Stasisfeld, Priorisierter Nachschub, Heiliges Banner mit Freischaltwelle, Kosten und Abklingzeit in Wellen. Gezielte Kommandos zeigen ihren Radius unter dem Zeiger, Escape bricht ab.
  - Darstellung (`src/render/effects.js`): Mündungsblitze, Laserstrahlen, Tesla-Blitze, Granaten im Bogen, Explosionen mit Brandflecken, Todesausbrüche, Schadenszahlen und Lebensbalken über verletzten Gegnern. Alles mit Obergrenzen, alles nur lesend auf dem Zustand.
  - Infoanzeige (`src/ui/info.js`): langes Drücken oder Mauszeiger zeigt Stellung, Gegner oder Gelände mit Werten und Zustand.
  - Punkte nach GDD Abschnitt 12 im Banner bei Sieg und Niederlage.
  - Debug-Panel (`?debug`): Welle anspringen, Requisition und Kommandopunkte geben, Kapselinhalt erzwingen, Unverwundbarkeit, Wellenstatistik mit den drei stärksten Stellungen.
  - Werkzeuge: `npm run playmatch` spielt eine ganze Partie ohne Browser und schreibt eine Zeile pro Welle, `npm run test:battle` spielt eine echte Partie im Browser bei 3x und scheitert an jedem Konsolenfehler.
  - Leistung (Playwright, Apple M2 mit GPU): Der Belastungstest kämpft jetzt mit. 200 Gegner und 40 feuernde Stellungen mit allen Effekten bleiben bei 60 fps, Rechenzeit 1,3 bis 2,0 ms pro Frame, 0 Rasterungen im Betrieb.
  - Tests: 222 Unit-Tests (Kampf, Doktrinen, Spezialstellungen, Fähigkeiten, Kommandos, Wirtschaft, Infoanzeige, Wellentabelle), darunter eine ganze Partie über 50 Wellen mit Prüfung der Invarianten und der Wiederholbarkeit.

## Offen
- Wirtschaft, Kampf und Kommandos sind da; offen bleibt das Feinjustieren in M6.
- Spezialstellungen haben keine eigene Grafik. Bis M4 nutzen sie das Sprite der ersten Zutat im Legendenrang mit goldenem Ring und Halo. Eigene Silhouetten stehen in M4 im Umfang.
- Bosse haben keine eigene Grafik. Bis M4 leihen sie sich die Figur eines verwandten Gegners, deutlich größer gezeichnet (`docs/ART.md`).
- Waffen drehen sich noch nicht zum Ziel. Die Sprites sind starr, der Schuss geht als Effekt vom Sockel aus. Bewegliche Läufe und Waffenköpfe kommen mit der SVG-Zerlegung in M4.
- Der Rüstungswechsel des Dämonenprinzen ist nur in der Infoanzeige zu sehen, an der Figur noch nicht.
- Veteran-Detail für Autokanone und Mörser festlegen (sie haben den Sandsackring schon).
- Ränge Elite, Held und Legende: Panzerplatten, Banner, Goldkanten und Halo fehlen noch (laut M1b später).
- Zerlegung der SVGs in bewegliche Teile (Läufe, Waffenköpfe, Beine, Flügel) und Herauslösen der eingebauten Effekte: M4.
- Sprite-Galerie (`tests/sprites.html`) ist nur ein Schaukasten: Verschieben, Zoomen, Treffer-Variante. Vorgeschlagen und vertagt: Beschriftungen der Figuren und ein Silhouetten-Schalter für die Regel „Silhouette vor Detail“ aus ART.md.
- Balancing-Beobachtungen aus `npm run playmatch` (Seed BASTION, Stellungen neben der Route, Nachschub wird gekauft, keine Kommandos): Die Partie trägt bis Welle 43. Die Wand sind die Flieger-Wellen, weil sie das Labyrinth überfliegen und nur Autokanone, Laser, Psi und Tesla sie treffen. Vorschlag für M6: entweder Flieger-Wellen entschärfen oder einen Hinweis geben, dass Luftabwehr gebraucht wird.
- Requisition staut sich: Ab Nachschubstufe 8 (etwa Welle 20) gibt es nur noch Trümmer abreißen als Ausgabe, am Ende liegen über 4000 ungenutzt herum. Kommandopunkte ebenso (50 KP bei vier Kommandos mit Abklingzeit). Beides ist ein Thema für M6, kein Fehler.
- Die Spezialstellungen, die Boss-Werte und die Kegel-, Strahl- und Sprungweiten der Doktrinen stehen nicht im GDD. Die eingetragenen Zahlen sind hergeleitet (siehe Entscheidungen) und gehören in M6 auf den Prüfstand.

## Bekannte Probleme
- **Welle 1 ist ohne eigene Markierungen verloren.** Wer nur „Salve anfordern" drückt, bekommt fünf zufällig verteilte Kapseln; die eine Stellung daraus steht oft nicht an der Route und trifft nichts. Welle 1 schickt nach GDD 30 Gegner (12 plus 0,5 pro Welle, bei Schwärmern das Doppelte) gegen 20 Leben: gemessen 30 Durchbrüche, Niederlage nach 55 Sekunden. Markiert man die Zonen neben der Route, fällt dieselbe Welle ohne einen einzigen Durchbruch. Zur Entscheidung für M6: Welle 1 verkleinern, das Ergänzen fehlender Zonen routennah machen oder im Spiel darauf hinweisen. Die Browser-Prüfung stützt die Bastion deshalb mit dem Debug-Hebel ab.
- Der Auswahldialog liegt über dem unteren Rand der Karte (620 × 141 px auf dem Tablet). Eine Kapsel, die genau dahinter liegt, lässt sich nicht antippen, über die Karten im Dialog aber trotzdem wählen.
- Das Ergänzen fehlender Landezonen prüft im schlimmsten Fall alle freien Felder (etwa 75 ms in einem sehr engen Labyrinth). Das passiert einmal pro Salve, fällt also nur als kurzer Hänger auf.
- Gegner laufen optisch durch die Signalfeuer-Säulen, weil das Signalfeuerfeld der Wegpunkt ist. Kann mit der finalen Grafik gelöst werden (z. B. Feuerschale neben dem Wegpunkt oder Säule als Torbogen).
- Ohne Stellungen fällt die Bastion in Welle 2 (12 Krieger plus 24 Schwärmer bei 20 Leben). Das ist bis M2 erwartbar, zum Testen einfach „Neue Partie“.
- Der Boden-Cache ist auf 12 Megapixel begrenzt (Speichergrenze von Safari). Bei maximalem Zoom auf dem iPad kann der Boden leicht unscharf werden, Objekte und Gegner bleiben scharf.
- Headless-Chromium mit Software-Rendering schafft nur etwa 30 bis 60 fps. Mit GPU (Apple M2) stabil 60 fps, auch mit 200 Sprite-Gegnern. Auf dem iPad bestätigt: Belastungstest mit 200 Gegnern läuft mit 60 fps. WebKit (Safari-Engine) wird automatisch getestet. Das ersetzt aber nicht den Test auf dem echten iPad, besonders nicht für Touch-Gesten mit mehreren Fingern: Die werden in WebKit als synthetische PointerEvents erzeugt, weil Playwright dort keine echten Mehrfinger-Berührungen senden kann.
- Im Belastungstest liegen die 200 Gegner sehr dicht auf der Route (bewusst, als Worst Case).
- Die Treffer-Variante ist vorbereitet, im Spiel blitzt aber noch nichts auf, weil es bis M3 keinen Schaden gibt.
- Hinweis: iPadOS ignoriert `display: fullscreen` im Manifest und nutzt `standalone`.

## Entscheidungen
- M3-Plan freigegeben (22.09.2026). Die Zahlen, die der GDD offen lässt, sind hergeleitet und stehen als Daten für M6 bereit:
  - **Boss-Werte** (`src/data/enemies.js`): Leben etwa anderthalb normale Wellen derselben Welle (Brutmutter 1800, Kolossbrecher 3500, Warp-Herold 3000 plus 1500 Schild, Schwarmkönigin 3500, Dämonenprinz 5000, jeweils mal dem Wellenfaktor), Tempo unter dem der Begleitung, Belohnung 50. Durchbruch kostet 5 Leben wie im GDD.
  - **Spezialstellungen** (`src/data/specials.js`): Jede ist etwa so stark wie ihre führende Doktrin einen Rang über dem Mindestrang des Rezepts und gibt den Rest ihres Budgets für das Besondere aus (Ring statt Kegel, drei Ziele, acht Sprünge, Betäubung). Ein Test hält fest, dass keine Spezialstellung schwächer ist als ihre Zutat.
  - **Seelenfeuer-Obelisk**: 3 % der maximalen Lebenspunkte pro Sekunde zusätzlich zum festen Schaden. Das ist die Waffe gegen Bosse, ohne dass eine Zahl im Spiel je zu klein wird.
  - **Orbitalschlag**: nimmt normalen Gegnern die vollen Lebenspunkte und Bossen ein Viertel (GDD-Obergrenze), als Anteil statt als feste Zahl, damit er in Welle 15 und in Welle 50 gleich viel wert ist. Er geht an der Schadensmatrix vorbei, weil er keine Doktrin ist.
  - **Form der Doktrinen** (`src/data/doctrines.js`): Kegelwinkel der Flamme 0,7 rad zu jeder Seite, Strahlbreite des Lasers 0,5 Felder, Sprungweite des Teslas 2,5 Felder. Der GDD nennt nur Kegel, Linie und Kette.
  - **Start-Requisition 0**: Die erste Welle bezahlt die erste Nachschubstufe.
  - Endlosmodus und Bestwerte bleiben vertagt: Punkte werden in M3 berechnet und angezeigt, gespeichert wird in M5 über die Speicherschicht.
- M3, Umsetzung:
  - Die Wellentabelle wird erzeugt, nicht zur Laufzeit gerechnet: `npm run waves` schreibt alle 50 Wellen aus. So ist jede Welle einzeln les- und änderbar, wie es der GDD verlangt, und die Regeln stehen an einer Stelle.
  - Der Warp-Schild verschluckt einen zu großen Treffer nicht: Was über den Schild hinausgeht, wird zurückgerechnet und trifft das Fleisch darunter mit dessen Faktor.
  - Schaden wird auf den tatsächlich verbleibenden Lebenspunkten gedeckelt, damit die Wellenstatistik keine Überschüsse ausweist.
  - Brandschaden wird der Stellung angerechnet, die das Feuer gelegt hat.
  - Die Doktrin einer Spezialstellung ist ihre erste Zutat. Der Glutkessel ist deshalb eine Flammen-Waffe mit Blitzen und zielt nicht auf Flieger, gegen die Flamme nichts ausrichtet.
  - Eine Welle endet erst, wenn auch die letzte Granate eingeschlagen ist.
  - Der Belastungstest kämpft mit: Die Gegner werden jeden Schritt wieder geheilt, damit die Messung die Last einer vollen Welle abbildet statt eines leeren Feldes.
  - Kommandos zählen in der Planung gegen die Welle, die die Salve vorbereitet. „Ab Welle 25" heißt also: in der Planung vor Welle 25 nutzbar.
  - Die Infoanzeige folgt am Desktop dem Mauszeiger und wird auf dem Tablet mit langem Drücken festgesetzt. Nichts ist nur über Hover erreichbar.
  - Das Debug-Panel ist Werkzeug, kein Spielerbildschirm: Seine Knöpfe sind kleiner als die 44 Pixel, die für alles andere gelten.
- M2-Plan freigegeben (22.09.2026):
  - Nachschubstufe bleibt ohne Wirtschaft auf 1, dazu ein Debug-Schalter (`N`, `?supply=`), damit Verschmelzen und Rezepte prüfbar sind.
  - Spezialstellungen bekommen in M2 nur eine Platzhaltergrafik, eigene Silhouetten kommen in M4.
  - Verschmelzen endet bei Legende: zwei Legenden lassen sich nicht verschmelzen, für die Viererverschmelzung ist Elite der höchste Ausgangsrang. Das steht so nicht im GDD, folgt aber aus der Rangtabelle.
  - Erfüllen mehrere stehende Stellungen eine Zutat, wird die mit dem niedrigsten ausreichenden Rang verbraucht, bei Gleichstand die zuerst gebaute.
  - Trümmer abreißen gehört zur Wirtschaft und damit zu M3.
- M2, Umsetzung:
  - Kapseln werden Kapseln vorgezogen: Deckt eine Zutat sowohl eine Kapsel der Salve als auch eine stehende Stellung ab, wird die Kapsel genommen. Nicht genutzte Kapseln werden ohnehin zu Trümmern, eine verbrauchte Stellung ist ein echter Verlust.
  - Welche Kapseln beim Verschmelzen als „benutzt“ gelten, ist gleichgültig: Alles außer der gewählten Kapsel wird zu Trümmern. Entscheidend ist allein, auf welchem Feld das Ergebnis steht.
  - Der Auswahldialog braucht zwei Tipper (Kapsel, dann Aktion). Ein Tipp auf die Kapsel auf der Karte wählt sie aus, löst aber nichts aus, damit nichts versehentlich festgelegt wird.
  - Kapselfelder werden beim Aufschlag blockiert, nicht schon beim Anfordern. So schließt sich das Labyrinth sichtbar, und die Route wird nach jedem Einschlag neu berechnet.
  - Der Zufall der Salve wird in zwei Zweige geteilt: `fork('zones')` für das Ergänzen der Zonen, `fork('contents')` für die Inhalte. Damit hängt der Kapselinhalt nicht davon ab, wie viele Zonen der Spieler markiert hat.
  - Der Belastungstest stellt zusätzlich 40 Stellungen auf und räumt sie beim Beenden wieder weg, damit die Messung die Last einer späten Partie abbildet.
  - Nach dem ersten Durchspielen gekürzt und verschlankt: Die Kapselsequenz läuft in 3,2 statt 5,4 Sekunden (Vorwarnung, Sturz und Öffnen gestrafft, die Reihenfolge aus dem Stiltest bleibt). Der Auswahldialog ist auf 620 px begrenzt, die Kapselkarten sind zweizeilig, damit möglichst wenig Karte verdeckt wird.
- Grafik-Konzept (22.09.2026): Gegner sind eine insektoide Brut (`docs/ART.md`). Umbenennung in der GDD: Mutant heißt jetzt Krieger, Warp-Geist heißt jetzt Warp-Seher. M1b wird als Grafik-Pipeline vor M2 eingeschoben.
- M1b-Plan freigegeben (22.09.2026):
  - Autokanone und Mörser haben den Sandsackring schon in der Grundform. Beim Veteran zeigen sie in M1b nur den zweiten Winkel, ein eigenes Veteran-Detail wird später festgelegt (z. B. zusätzliche Munitionskisten).
  - Eingebaute Effekte in den SVGs (Flammenstrahl, Mündungsbögen, Rauch, Blitze, Leuchten) bleiben in M1b im Sprite. In M4 werden sie aus den SVGs entfernt und per Code animiert.
  - GDD Abschnitt 1: „Mutanten“ und „Mutantenhorden“ durch „Schwarmbrut“ ersetzt.
- M1b, Umsetzung:
  - Kennungen im Code folgen der GDD: `warrior` (Krieger) und `warpseer` (Warp-Seher). Die Symbolnamen im SVG bleiben `e-mutant` und `e-ghost`, die Zuordnung steht im Manifest.
  - Maßstab: Die Sockel-Oberseite deckt 90 % der Feldbreite ab. Gegner werden einheitlich mit 0,42 Weltpixeln pro SVG-Einheit gezeichnet, so bleiben die Größenverhältnisse der Skizzen erhalten (Krieger etwa 48 px hoch, Brecher knapp feldbreit).
  - Der Warp-Seher schwebt laut Skizze leicht über dem Boden, die Heiler-Aura reicht unter die Füße. Beides bleibt so.
  - Winkel liegen im Band oberhalb des Warnstreifens, gezeichnet nach Waffe und Sandsäcken, damit nichts sie verdeckt.
  - Die Treffer-Variante ist ein warmweißer Überzug mit 65 % Deckkraft. So bleiben Silhouette und Tuschelinien erkennbar.
  - Browser-Tests laufen in Chromium und WebKit. Schalter `--browser webkit`, Standard ist Chromium.
  - SVG-Bilder werden über das `load`-Ereignis geladen, nicht über `img.decode()`, weil Safari das bei SVG teils ablehnt. Die SVGs bekommen eine feste Pixelgröße, weil Safari sonst in ihrer Eigengröße rastert und das Bild unscharf wird.
- Plattform: Desktop und Tablet gleichwertig, Tablet ist der Haupteinsatz.
- Hosting: GitHub Pages, PWA. Speichern lokal, Speicherschicht für spätere Online-Bestenliste vorbereitet.
- Kapseln nur in der Planungsphase. Spezialkommandos auch während der Welle.
- Fortschritt über mehrere Partien: vertagt bis nach den ersten Tests.
- Schriften werden selbst ausgeliefert statt über Google Fonts (offline-fähig, Datenschutz).
- Zufallsgenerator mulberry32. Seeds dürfen Text sein (FNV-1a-Hash). Karte und Kapseln bekommen eigene Zweige über `fork('map')` und `fork('pods')`. Ein Test hält die Zahlenfolge fest, damit geteilte Seeds über Versionen gleich bleiben.
- Nach einer langen Unterbrechung (Hintergrund-Tab) holt die Simulation nicht auf, sondern verwirft den Rückstand.
- Die Speicherschicht speichert JSON. `set` meldet mit `false`, wenn nicht dauerhaft gespeichert werden konnte.
- Das Screenshot-Skript startet einen eigenen kleinen Node-Server (`tests/tools/server.mjs`).
- M1, freigegeben am 22.09.2026:
  - Signalfeuer-Reihenfolge vom Riss aus: nahes Viertel links → fernes rechts → fernes links → nahes rechts. Die Teilstrecken 1 → 2 und 3 → 4 kreuzen sich in der Mitte.
  - Der Seed wählt die Kante des Risses, die Bastion liegt gegenüber, die Position entlang der Kante ist zufällig (mindestens 6 Felder von den Ecken).
  - Ruinen und Krater belegen 1 Feld, Mauerreste 2 bis 3 Felder in einer Linie. 12 bis 20 zählt Objekte.
  - Ziehen mit der linken Maustaste verschiebt die Karte ebenfalls (ab 8 px), ein Klick bleibt Auswahl.
  - Routenlänge: echte Weglänge, eine Diagonale zählt √2, gerundet angezeigt.
  - Die Auswertung läuft nach 2 s von selbst weiter (`RULES.evaluationSeconds`).
- Seeds für neue Partien bestehen aus 6 Zeichen ohne verwechselbare Zeichen (kein 0/O, 1/I). Eingaben werden in Großbuchstaben umgewandelt. „Neue Partie“ schreibt den Seed in die Adresse, damit man die Karte teilen kann.
- Signalfeuer sind begehbare Wegpunkte, Riss und Bastion auch. Gegner laufen durch ihre Mitte.
- Debug-Hindernisse sind Trümmer (`kind: 'rubble'`). Diese Grafik nutzt M2 für die nicht gewählten Kapseln weiter. Das Entfernen per Debug löscht das ganze Hindernisobjekt, also bei Mauerresten alle Felder.
- Tiefensortierung: Objekte auf einem Feld nach `x + y + 1`, Gegner nach `x + y`. Der seitliche Versatz der Gegner in der Kolonne ist rein optisch und hängt an der Gegner-ID.
