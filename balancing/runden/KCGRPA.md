# KCGRPA: Tills erste Partie unter Regelversion 9 (Welle 22)

**Grundlage:** `protokolle/nachschubfront-2026-11-05-KCGRPA-welle22.json`, Regelversion 9,
aufgezeichnet mit 0.11.21 (Vorschau von PR #91), nachgespielt mit 0.11.20: gleiches Ergebnis
Welle für Welle, saubere Partie (keine Debug-Hebel). 22 Wellen, 192 Aktionen (eine davon
übersprungen: eine Zone, die schon markiert war), Partie offen. Vier Wellen bewertet.
Nichts geändert, nur Befunde. Teil 2 unten: das Ruckeln am Ende der Partie.

## Verlauf

| Abschnitt | Leben | Was auffällt |
|---|---|---|
| Welle 1 | 20 → 15 | **5 Durchbrüche mit der ersten Stellung**, Route 36,9 Felder. Bewertet „passt“. |
| Welle 2 bis 22 | 15 | Kein einziger Durchbruch mehr, auch nicht am Boss in Welle 10 und 20. Bewertungen in Welle 8, 13 und 18: „zu leicht“. |

Die Route wächst über die ganze Partie nur von 36,9 auf **45,9 Felder**. Till hat diesmal kein
Labyrinth gebaut, sondern eine dichte Stellung an der Strecke: 20 Stellungen in Welle 22, davon
6 Held und 2 Legende, dazu 5 Spezialstellungen (zweimal Sturmbatterie, Belagerungsmörser,
Seelenfeuer-Obelisk, Glutkessel).

## Requisition und Nachschubstufe

- Die sieben Käufe der Nachschubstufe liegen in den Planungen nach Welle 1, 2, 4, 6, 8, 10 und 12
  (zusammen 1040 R). **Stufe 8 steht ab Welle 13**, wie in F7SZGZ.
- Bis dahin wird die Requisition fast vollständig ausgegeben (nach dem letzten Kauf bleiben 2 R).
- Danach steigt sie von 131 (Welle 13) auf **1382** (Welle 22). Eingenommen werden in den Wellen
  13 bis 22 etwa **1620 R, im Mittel 162 je Welle**. Ausgegeben davon: 180 R für eine Beförderung
  und 60 R für drei Abrisse (Kapseln auf Trümmern), zusammen **15 %**.
- Bollwerke: **keine.** Bis Welle 22 gibt es dafür auch keinen Anlass, sie zählen erst gegen den
  Koloss in Welle 35 (F7SZGZ baute seine zwölf vor Welle 34). Ein Bollwerk hätte 60 R gekostet.
- Kommandos: ein Orbitalschlag in Welle 17 (10 507 Schaden, 11 % der Welle). Die Kommandopunkte
  stehen am Ende bei 23.

## Befördern: einmal genutzt

Die eine Beförderung liegt in der Planung vor Welle 22: der Flammenwerfer (Stellung 6) von Rekrut
auf Veteran für 180 R, bei 1340 R im Vorrat.

Gelegenheiten in den neun Planungen ab Stufe 8 (vor Welle 14 bis 22, Preise aus `ECONOMY.promote`):

| Ziel | Preis | bezahlbar in Planungen | Kandidat vorhanden |
|---|---|---|---|
| Veteran | 180 | 8 von 9 (ab Welle 14) | ja, ein Rekrut die ganze Zeit |
| Elite | 450 | 7 (ab Welle 15) | ja, 4 Veteranen |
| Held | 1100 | 2 (Welle 20 und 21) | ja, ein Elite |
| Legende | 2800 | 0 | – |

Genutzt wurde **1 von 8 möglichen Beförderungen**, und die billigste. Das ist dieselbe Quote wie
bei der alten Aufwertung (F7SZGZ: einmal in 38 Wellen) und wie bei den Bots (0,0 bis 0,8 je
Partie, `bots-regelversion-9.md`). Die Abschätzung in `geldsenke-vorschlag.md` (Variante A bindet
in F7SZGZ etwa 3510 R bis Welle 29) setzte eine Beförderung in jeder bezahlbaren Planung voraus;
diese Partie bindet bis Welle 22 nur 180 R. **Die Senke ist da, wird aber nicht genommen.**

Was das Protokoll nicht sagen kann: ob Till das Werkzeug erst spät gefunden hat, ob er keine
Stellung für lohnend hielt oder bewusst gespart hat. Die Partie lief ohne jede Gefahr, also gab
es auch keinen Druck, Requisition in Feuerkraft zu verwandeln.

## Vergleich mit F7SZGZ (gleiche Wellen 1 bis 22)

| | KCGRPA (Regel 9) | F7SZGZ (Regel 8) |
|---|---|---|
| Leben nach Welle 22 | 15 (alle 5 in Welle 1) | 14 (1 in Welle 8, 5 am Boss in Welle 20) |
| Route Welle 1 / 22 | 36,9 / **45,9** | 59,1 / **170,8** |
| Stellungen Welle 22 | 20: 0/6/1/6/2 plus 5 Spezial | 16: 2/4/3/0/0 plus 7 Spezial |
| Stufe 8 ab | Welle 13 | Welle 13 |
| Requisition Welle 22 | 1382 | 1580 |
| Ausgaben ab Stufe 8 bis Welle 22 | 240 R (Beförderung, Abrisse) | etwa 0 |
| Verschwendeter Schaden Welle 22 | 13 484 | 13 357 |
| Bewertungen | 1x passt (W1), 3x zu leicht (W8, 13, 18) | 4x passt (W1, 8, 13, 18) |

Lebenspunkte und Schaden der Wellen sind fast gleich, weil die Wellen von der Nummer abhängen,
nicht von der Karte.

## Schlüsse für M6 (Vorschläge, nichts entschieden)

1. **Ein kurzer Weg trägt bis Welle 22 ohne Verlust.** Bisher galt, dass die Routenlänge alles
   dominiert (PROGRESS, „Die Schere“). Hier hält Till mit einem Viertel der Route von F7SZGZ
   dieselben Wellen sogar besser, darunter den Boss in Welle 20. Getragen wird das von hohen Rängen
   (6 Held, 2 Legende in Welle 22), die in F7SZGZ in Rezepte gingen. Eine Partie ist kein Beleg;
   aber die Wellen 2 bis 22 sind für einen erfahrenen Spieler unter Regel 9 auf beiden Wegen ohne
   Gefahr. Vorschlag: die Partie bis Welle 35 weiterspielen lassen, denn ein kurzer Weg ist gegen
   den Koloss etwas ganz anderes als gegen die Wellen davor.
2. **Befördern bindet die Requisition nicht.** 15 % der Einnahmen ab Stufe 8 ausgegeben, eine von
   acht möglichen Beförderungen. Bevor an Preisen gedreht wird, sollte Till sagen, warum er nicht
   befördert hat (siehe Fragen unten). Ist es Bedienung, hilft ein Ruf-Ring wie beim Nachschub
   (Runde 5) am Werkzeug, sobald eine Beförderung bezahlbar ist. Ist es der Wert, wäre ein
   niedrigerer Preis der ersten zwei Stufen der Hebel (heute 155 R je Schadenseinheit gegen etwa
   100 R bei der alten Aufwertung).
3. **Welle 1 kostet hier ein Viertel der Leben.** Auf einer Karte mit kurzem Grundweg (36,9 Felder)
   reicht die eine Rekrutenstellung nicht. Till nennt es „passt“, ein neuer Spieler verliert damit
   gleich zu Beginn 5 Leben. Das war auch in früheren Runden der eine harte Anfang (W1 „zu schwer“).
   Zu prüfen, nicht zu ändern: ob die Länge des Grundwegs der Karte die erste Welle so stark
   bestimmt, dass ein Mindestweg im Kartengenerator der richtige Hebel wäre statt der Welle.

## Fragen an Till

- Hast du das Befördern vor Welle 22 gesehen und bewusst gelassen? Wenn ja: zu teuer, keine
  passende Stellung, oder lieber gespart?
- War der kurze Weg Absicht (Test der dichten Stellung) oder hat die Karte nicht mehr hergegeben?
- Spielst du die Partie bis zum Koloss weiter? Das wäre die erste Messung eines kurzen Wegs gegen
  Welle 35 unter Regel 9.
