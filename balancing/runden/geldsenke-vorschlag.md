# Geldsenke: Vorschlag mit Zahlen (A-42, Issue #82, zu Akte E-41)

**Stand:** 05.11.2026, Regelversion 8, Version 0.11.16. Nur ein Vorschlag, nichts im Spiel
geändert. Grundlage ist Tills Partie F7SZGZ ([`F7SZGZ.md`](F7SZGZ.md)) und Tills Antwort auf
E-41: „in der planungsphase vorhandene stellungen anklicken […] mit requisition vor dem start
der salve upgraden […] oder den stellungen noch zusatzfunktionen wie eine buff aura für alle
stellungen in der nähe“.

**Zu allen Abschätzungen unten:** Sie stammen aus einem Nachspiel von F7SZGZ, in das eine
einfache Regel die neuen Käufe einspielt (Skript beschrieben im Anhang). Tills übrige
Entscheidungen bleiben, wie sie waren, obwohl er mit mehr Feuerkraft anders gespielt hätte.
Die Bots sind nicht an echten Partien geeicht (`balancing/README.md`), deshalb wurden sie hier
nicht herangezogen. **Alle Zahlen sind Richtwerte aus einer Partie eines erfahrenen Spielers,
keine Messung.** Belastbar wird es erst mit neuen Protokollen.

## Ausgangslage in Zahlen

| | Wert in F7SZGZ |
|---|---|
| Nachschubstufe voll | Welle 13 (Requisition danach 139) |
| Einnahmen Welle 14 bis 38 | etwa **4700 R**, im Mittel **187 je Welle** (Bilanz aus den Wellenzeilen plus den bekannten Ausgaben) |
| Höchststand | 2994 R in Welle 29 |
| Ausgaben danach | eine Aufwertung statt Bau auf Legende (1875, Welle 30), zwölf Bollwerke (etwa 1800, vor Welle 34) |
| Route ab Welle 25 | steht bei 184,8 Feldern, obwohl jede Runde eine Salve landet |
| Stellungen Welle 29 | 2/4/4/3/3 (Rekrut bis Legende) plus 7 Spezialstellungen, 23 insgesamt |

Zwei Befunde tragen den ganzen Vorschlag:

1. **Die heutigen Preise der Aufwertung sind schon schadensgerecht.** Ein Rang bringt in
   Vielfachen des Rekrutenschadens (`src/data/ranks.js`): +1,2 (auf Veteran), +2,8 (Elite),
   +7 (Held), +18 (Legende). Die Preise 120 / 300 / 750 / 1875 sind dazu fast genau
   verhältnisgleich: **100 / 107 / 107 / 104 R je Schadenseinheit.** Die Aufwertung ist also
   nicht zu teuer in Requisition. Sie scheitert an der Kapsel, die sie zusätzlich kostet: Eine
   Kapsel auf Nachschubstufe 8 bringt im Mittel 8,8 Schadenseinheiten
   (0,05·1 + 0,2·2,2 + 0,35·5 + 0,3·12 + 0,1·30) plus ein Feld im Labyrinth.
2. **Stellungen stehen im Labyrinth vereinzelt.** Aus jeder Salve wird genau eine Stellung, der
   Rest wird Trümmer. In F7SZGZ hat eine Stellung im Mittel **0,5 bis 0,9 Nachbarstellungen im
   Radius 2,5**, unter Radius 2 fast keine. Der Schaden ist aber stark gebündelt: In den
   Wellen 25 bis 29 liegen 45 % des Stellungsschadens bei zwei Stellungen, die zusammen im
   Radius 2,5 einer dritten stehen. Eine Aura lohnt sich damit an genau einer oder zwei
   Stellen der Karte, nicht überall.

## Variante A: Gezielte Aufwertung („Befördern“)

**Regel.** In der Planungsphase tippt der Spieler eine stehende Stellung an und hebt sie für
Requisition um einen Rang. Keine Kapsel, kein Feld, die Salve bleibt unberührt.

| Punkt | Vorschlag | Begründung |
|---|---|---|
| Ab wann | **sobald Nachschubstufe 8 erreicht ist** | Vorher konkurriert das Befördern mit der Nachschubstufe, die alle künftigen Kapseln hebt; ein früher Rang würde das abgestimmte frühe Spiel (Band aus Runde 3) verschieben. Die Stufe 8 ist zugleich der Moment, ab dem die Requisition liegen bleibt. Für neue Spieler, die Nachschub spät kaufen, bleibt die Nachschubstufe die Senke. |
| Preise | **180 / 450 / 1100 / 2800** (auf Veteran / Elite / Held / Legende) | Das 1,5-Fache der heutigen Preise, also etwa **155 R je Schadenseinheit** auf jeder Stufe. Heute zahlt der Spieler Kapsel plus Requisition, künftig nur Requisition; ohne Aufschlag wäre der Rang billiger als je zuvor. Die Stufe bleibt in `economy.js` als Grundpreis plus Faktor (`upgradeCostBase` 180, `upgradeCostPerRank` 2,5). |
| Grenze | **eine Beförderung je Planungsphase** | In den Nachspielen hat die Grenze nie gebremst, das Einkommen tut es (bei 2 statt 1 je Phase dasselbe Ergebnis). Sie verhindert nur, dass ein angespartes Polster kurz vor dem Koloss in einem Zug in zwei Legenden fließt, und macht das Befördern zu einer Entscheidung jeder Runde. |
| Was gilt | nur Stellungen mit Rang (keine Spezialstellungen), höchstens bis Legende | wie heute (GDD Abschnitt 11) |
| Rezepte | eine beförderte Stellung zählt als Zutat mit ihrem neuen Rang | sonst müsste das Spiel sich Herkunft merken; es macht Rezepte mit Mindestrang leichter erreichbar, das ist gewollt |
| Aufwertung statt Bau | **entfällt** | Gegen das Befördern ist sie in jedem Fall schlechter: gleicher Rang, aber zusätzlich eine Kapsel. Zwei Wege zum selben Ziel, von denen einer immer verliert, sind keine Wahl. King of the Hill behält seine eigene Aufwertung (`upgrade.kind: 'ladder'`), sie ist nicht berührt. |

**Bedienung.** Ein Werkzeug „Befördern“ in der Planungsphase, gebaut wie der Abbruchmodus
(GDD Abschnitt 13): Ist es aktiv, tragen alle beförderbaren Stellungen den Preis am Feld, eine
nicht bezahlbare ist ausgegraut. Antippen befördert, auf dem Tablet mit kurzer Bestätigung.
Damit kein neues Antipp-Verhalten auf der Karte entsteht (Tippen markiert Zonen, langes
Drücken zeigt Infos), und es geht auf dem Handy über denselben Knopf wie der Abriss.

**Abschätzung F7SZGZ** (eine Beförderung je Phase ab Nachschubstufe 8, die Regel wählt die
Stellung mit dem meisten bisherigen Schaden je Rangfaktor, also die am besten gestellte):

| | ohne | heutige Preise | **Vorschlag ×1,5** | ×2 |
|---|---|---|---|---|
| Beförderungen bis Welle 38 | 0 | 11 | **9** | 8 |
| gebundene Requisition | 0 | 4290 | **3510** | 4080 |
| Requisition in Welle 29 | 2994 | 254 | **434** | 794 |
| Stellungen Welle 29 (R/V/E/H/L) | 2/4/4/3/3 | 0/0/8/4/4 | **0/1/8/3/4** | 0/3/6/3/4 |
| Schadenseinheiten Welle 29 | 157 | 208 (+33 %) | **198 (+26 %)** | 193 (+23 %) |
| Boss Welle 20 | 1 durch, −5 Leben | 0 durch | **0 durch** | 0 durch |
| Koloss Welle 35 | 1 durch, −8 Leben | 1 durch, −8 | **1 durch, −8** | 1 durch, −8 |
| Leben nach Welle 38 | 6 | 11 | **11** | 11 |

Im Nachspiel gingen dadurch sieben (bei ×1,5) bis zehn (heutige Preise) von Tills zwölf
Bollwerken vor Welle 34 nicht mehr (zu wenig Requisition). Das zeigt, dass Befördern und Bollwerk um dasselbe Geld konkurrieren; Till hätte
anders entschieden. Ab Welle 20 statt ab Stufe 8 freigeschaltet, ändert sich mit den
vorgeschlagenen Preisen nichts (gleiche Bilanz, Boss ebenfalls ohne Durchbruch); mit den
heutigen Preisen kostet der Boss dann wieder 5 Leben. Der Boss in Welle 20 ist in allen Läufen
knapp (ein Durchbruch mit wenig Restleben), dieser Unterschied ist also eher Zufall als Wirkung.

**Was das heißt:** Variante A bindet drei Viertel des Überschusses und macht die Partie für einen
starken Spieler leichter. Den Koloss löst sie nicht, die einzige echte Prüfung des Spätspiels
bleibt. Interessant für die Spieltiefe: Die Regel hat fast nur Rekruten und Veteranen an guten
Stellen befördert, nicht die Legenden. **Wo** befördert wird, ist die Entscheidung, nicht ob.

## Variante B: Aura-Ausbau („Feldstandarte“)

**Regel.** Eine stehende Stellung bekommt in der Planungsphase für Requisition eine
Feldstandarte. Sie stärkt dauerhaft die Stellungen in ihrem Umkreis.

| Punkt | Vorschlag | Begründung |
|---|---|---|
| Ab wann | Welle 20 (nach dem ersten großen Boss) | Vorher stehen zu wenige Stellungen, als dass zwei nebeneinander stünden. |
| Radius | **2,5**, gemessen von Feldmitte zu Feldmitte | Unter 2,5 erreicht die Standarte im Labyrinth praktisch nichts (Befund 2, bester Ort 6 % des Schadens). 2,5 ist der Radius des Heiligen Banners: ein Kreismaß im Spiel statt zwei. |
| Stärke | **+20 % Schaden** | Ein Banner (+50 %, eine Welle, 2 KP) soll stärker bleiben. Die Standarte ist der kleine dauerhafte Bruder. |
| Wer profitiert | die Stellungen im Radius, **nicht** der Träger selbst | Dann lohnt es, die Standarte auf eine schwache Stellung inmitten starker zu setzen, statt einfach auf die stärkste. |
| Stapeln | **nicht stapelbar**: Steht eine Stellung im Radius mehrerer Standarten, gilt eine | Wie beim Banner (`bannerBonus` nimmt das Maximum). Abnehmendes Stapeln wäre schwerer zu lesen und hat keinen Mehrwert, wenn ohnehin nur ein bis zwei Orte lohnen. |
| Zum Heiligen Banner | **wirkt mal**: 1,5 × 1,2 = 1,8 | So bleibt der Banner überall genau +50 % wert, auch unter einer Standarte; „darf ihn nicht entwerten“ ist damit wörtlich erfüllt. Bei Addition (1,7) wäre der Banner unter einer Standarte nur noch +42 % wert. |
| Prozentschaden | gilt nur für den festen Schaden, nicht für Prozentanteile (Obelisk) | wie heute beim Banner (`combat.js` multipliziert `stats.damage`); der Bossdeckel des Obelisken bleibt unberührt |
| Preis | **600, dann je weitere Standarte ×1,5** (600 / 900 / 1350 / 2025 …) | Eine Standarte am besten Ort hebt in F7SZGZ etwa 30 bis 45 % des Stellungsschadens um 20 %, also den Gesamtschaden um 6 bis 9 %. Bei 157 Schadenseinheiten in Welle 29 sind das 10 bis 14 Einheiten, zum Preis der Variante A etwa 1500 bis 2200 R. 600 für die erste ist bewusst günstiger, weil der Wert erst entsteht, wenn um sie herum gebaut wird. Der steigende Preis ist die Grenze. |
| Grenze je Phase | eine Standarte je Planungsphase | wie A |
| Abriss | Wird der Träger abgerissen oder als Zutat verbraucht, ist die Standarte weg, ohne Erstattung; der nächste Preis sinkt nicht | einfach, und ein Grund mehr, den Träger mit Bedacht zu wählen |

**Lesbarkeit auf der Karte.** Ein Wimpel am Träger (Teil des Sprites, kein eigenes Bild pro
Frame) und in der Planung ein dünner Kreis in der Banner-Farbe, gestrichelt statt voll, damit
Standarte (dauerhaft) und Banner (eine Welle) nicht verwechselt werden. Gestärkte Stellungen
tragen ein kleines Abzeichen neben dem Winkel. Während der Welle nur der Wimpel, keine Kreise,
damit die Karte bei 200 Gegnern nicht zuläuft.

**Abschätzung F7SZGZ** (Standarte bei Requisition ≥ Preis an den Ort mit dem meisten noch nicht
gestärkten Schaden, ab Welle 20; angenähert über den Banner-Mechanismus, der Träger zählt dabei
mit):

| | ohne | **+20 %, 600 ×1,5** | +25 %, 500 ×1,5 |
|---|---|---|---|
| Standarten | 0 | 3 (Welle 20, 23, 30) | 3 (Welle 20, 22, 28) |
| gebundene Requisition | 0 | **2850** | 2375 |
| Requisition in Welle 29 | 2994 | 1494 | 619 |
| Boss Welle 20 | −5 Leben | −5 | −5 |
| Koloss Welle 35 | −8 Leben | −8 | −8 |
| Schaden Koloss-Welle 35 | 677 149 | 712 230 (+5 %) | 695 210 (+3 %) |

**Was das heißt:** B bindet gut die Hälfte des Überschusses und ändert an den Prüfungen nichts.
In Tills Labyrinth wirkt eine Aura schwach, weil Stellungen vereinzelt stehen. Sie würde erst
stark, wenn Spieler anders bauen (Zonen gebündelt setzen, um die behaltene Kapsel neben die
Standarte zu bringen). Das ist echte Spieltiefe, aber sie zieht gegen das Labyrinth, das
Nachschubfront ausmacht. Und sie verlangt neue Grafik (Wimpel, Kreis, Abzeichen).

## Variante C: Zusatzkapsel (aus E-41, zum Vergleich)

Ab Nachschubstufe 8 lässt sich in der Planung eine Kapsel zusätzlich zur Salve kaufen, eine je
Salve, Preis steigend mit jedem Kauf in der Partie (zum Beispiel 150, +50 je Kauf). Spät bringt
die zusätzliche Kapsel vor allem eine bessere Wahl, keine längere Route: Die Route stand in
F7SZGZ ab Welle 25 still, die Karte ist dort voll. Die Chance auf mindestens eine Legende steigt
von 41 % (5 Kapseln) auf 47 % (6), dazu mehr Gelegenheiten zum Verschmelzen. Dagegen: jede
Kapsel ein weiteres Trümmerfeld, früh ein schnelleres Labyrinth. Nicht nachgespielt, weil eine
zusätzliche Kapsel die Kapselinhalte der Welle verschiebt (`fork('contents')`) und Tills
Auswahl dann nicht mehr passt.

## Vergleich

| | A Befördern | B Feldstandarte | C Zusatzkapsel |
|---|---|---|---|
| Spieltiefe | mittel bis hoch: wo befördern, gegen Bollwerk und Nachschub abwägen | hoch, aber gegen das Labyrinth: belohnt Bündeln | gering: mehr vom Gleichen, Würfelglück |
| Bindet in F7SZGZ | 3510 von etwa 4700 R | 2850 | nicht gemessen |
| Risiko Balancing | mittel: +26 % Schaden in Welle 29 für Till, das Mittelspiel wird für starke Spieler leichter (vorher „passt“) | gering: +3 bis 5 % Schaden, Prüfungen unverändert | mittel: Trümmer und Route früh, schwer nachzuspielen |
| Nachspielbarkeit | einfach, neue Aktion | einfach, neue Aktion | schwer, verschiebt Kapselinhalte |
| Aufwand `src/data` | `economy.js` (Preise, ab Stufe 8, je Phase) | `economy.js` oder neu `auras.js` (Radius, Stärke, Preise) | `economy.js`, `supply.js` |
| Aufwand `src/sim` | neue Aktion in `actions.js`, `record.js`, `replay.js`; `upgradeOptions` aus `selection.js` entfernen (alte Protokolle mit `select:upgrade` müssen weiter nachspielbar bleiben) | `actions.js`, `combat.js` (Faktor neben `bannerBonus`), `towers.js` (Abriss), `record.js`, `replay.js` | `zones.js`, `pods.js` (Inhalt der Zusatzkapsel deterministisch), `actions.js`, `replay.js` |
| Aufwand `src/ui`, `src/render` | Werkzeug wie Abbruchmodus, Preise am Feld, Aufwertung aus `ui/selection.js` entfernen, Texte | Werkzeug, Wimpel am Sprite, Kreis, Abzeichen, Texte (ART.md ergänzen) | Knopf in der Planung, Texte |
| Lesbarkeit neue Spieler | gut: „Stellung antippen, ein Winkel mehr“ | mittel: Kreis, Abzeichen, Stapelregel | gut |
| Handy | gut, ein Werkzeugknopf wie Abriss, Trefferfläche ist die Stellung | mittel, Kreise auf kleinem Bildschirm, Trägerwahl braucht Zoom | gut, ein Knopf |

## Empfehlung

**Variante A mit den Zahlen oben, ohne B und C für jetzt.**

- Sie löst genau das, was Till und die Auswertungen benennen: Die Aufwertung scheitert an der
  Kapsel, nicht am Preis. Ohne Kapsel und mit freier Wahl der Stellung wird sie eine echte
  Ausgabe, und sie bindet in F7SZGZ drei Viertel des Überschusses.
- Sie ersetzt eine schwache Regel, statt eine dritte Senke neben Bollwerk und Nachschub zu
  stellen, und sie passt zur Labyrinth-Idee: Wer gut gestellte Stellungen hat, kann sie stärken.
- Sie ist nachspielbar und mit wenig neuer Grafik zu bauen.

**Was ich nicht empfehle, obwohl es naheliegt:** B jetzt dazuzunehmen. In Tills Partien steht der
Schaden an ein, zwei Stellen, eine Aura wirkt dort kaum (+3 bis 5 %) und bringt viel Neues auf
die Karte. Sinnvoll wäre B später als eigene Runde, falls nach A noch Geld liegen bleibt, oder
als Rezept-ähnliche Spezialstellung statt als Kauf.

**Das Risiko von A ehrlich benannt:** Eine Senke, die Schaden kauft, macht das Spiel für starke
Spieler leichter. Für Till hieße das: Der Boss in Welle 20 hält in der Abschätzung nicht mehr,
das Mittelspiel wird noch ruhiger. Dagegen spricht, dass F7SZGZ dort schon „passt“ bewertet ist
und neue Spieler (die Nachschub spät kaufen) die Beförderung später oder gar nicht freischalten.
Ob danach die Mitte nachgezogen werden muss (Band aus Runde 3), zeigt erst die nächste Partie.

**Was sich im GDD ändern würde:**

- Abschnitt 3 (Planung): „In dieser Phase kann auch Requisition ausgegeben werden“ um das
  Befördern ergänzen; Abschnitt 3 (Auswahl) bleibt bei vier Möglichkeiten, die Aufwertung fällt
  weg.
- Abschnitt 6: Der Satz „Stellungen können nicht aufgewertet […] werden. Stärker werden sie nur
  über Verschmelzen und Rezepte“ wird um das Befördern ergänzt.
- Abschnitt 10: Befördern als Ausgabe in die Liste; Bollwerk bleibt.
- Abschnitt 11: „Aufwertung statt Bau“ wird ersetzt durch „Befördern“ (Regel, Preise, Grenze,
  ab Nachschubstufe 8).
- Abschnitt 13: Werkzeug „Befördern“ neben dem Abbruchmodus.
- Abschnitt 14: Die unbegrenzte Nachschubstufe bleibt vorgemerkt, die Feldstandarte kommt dazu.
- Regelversion 8 → 9; Bestwerte aus Regelversion 8 in eine eigene Liste, wie beim Wechsel 6 → 7.

## Offene Fragen an Till

1. **Ab wann:** ab Nachschubstufe 8 (Vorschlag) oder ab einer festen Welle (etwa 15 oder 20)?
   Mit Stufe 8 schalten Spieler, die Nachschub spät kaufen, es spät frei.
2. **Preis:** ×1,5 (180 / 450 / 1100 / 2800) oder die heutigen 120 / 300 / 750 / 1875? Die
   heutigen binden mehr, machen aber auch stärker.
3. **Aufwertung statt Bau streichen?** Der Vorschlag streicht sie, weil sie gegen das Befördern
   immer verliert.
4. **Soll das Mittelspiel für dich danach schwerer werden?** Wenn ja, wäre das eine eigene
   Runde nach der ersten Partie mit Befördern, nicht Teil dieses Vorschlags.
5. **Feldstandarte für später vormerken** (GDD Abschnitt 14) oder verwerfen?

## Anhang: wie die Abschätzungen entstanden

Zwei Wegwerfskripte im Scratchpad der Sitzung, nicht im Repository: Sie spielen
`protokolle/nachschubfront-2026-11-04-F7SZGZ-welle38.json` mit `replayMatch`
(`src/sim/replay.js`) nach und greifen über `onSelection` in den Zustand ein.

- **A:** In jeder Auswahlphase ab Nachschubstufe 8 höchstens eine Beförderung (`tower.rank += 1`,
  Requisition abgezogen), Preise wie in der Tabelle (die Spalte ×1,5 lief mit 180 / 450 / 1125 / 2810 und
mit den gerundeten 180 / 450 / 1100 / 2800, gleiches Ergebnis). Gewählt wird die Stellung ohne Spezialrezept mit dem höchsten bisherigen
  Schaden geteilt durch ihren Rangfaktor, die sich bezahlen lässt. Der Eingriff liegt in der
  Auswahl- statt in der Planungsphase derselben Runde; für die Welle danach ist das gleich.
- **B:** Eine Standarte wird als dauerhafter Banner (Radius 2,5, Faktor 1,2 oder 1,25) in die
  Bannerliste gelegt und beim Wellenstart nicht gelöscht. Weil `bannerBonus` das Maximum nimmt,
  rechnet ein echter Banner unter einer Standarte hier mit 1,5 statt 1,8, und der Träger profitiert
  mit. Beides überschätzt beziehungsweise unterschätzt die Wirkung leicht.
- Die Nachbarschaftszahlen (Befund 2) zählen je Stellung die Stellungen im Radius und deren Schaden
  aus den letzten fünf Wellen vor Welle 20, 29 und 38.

Tills Aktionen laufen unverändert weiter. Aktionen, die danach nicht mehr bezahlbar waren
(Bollwerke vor Welle 34, eine Kapsel auf Trümmern in Welle 29), wurden vom Nachspieler
übersprungen. Nachschub kaufte Till bis Welle 13, also vor jedem Eingriff.
