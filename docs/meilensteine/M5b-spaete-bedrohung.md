# M5b: Späte Bedrohung und Ressourcen-Senken

Einzuplanen nach M5 (Speichern und PWA), vor M6 (Balancing).

## Ziel
Grundlage: `docs/GDD-update-v3.md` und `docs/ART-update-v3.md`. Das Late Game bekommt mit dem Koloss eine echte Bedrohung, mit dem Bollwerk und der Direktbebauung von Trümmern zwei neue Werkzeuge, und die Spezialkommandos werden geschärft. Dazu ein wichtiger Bugfix und drei kleinere UX-Korrekturen aus den letzten Testspielen.

## Vorarbeit
Beide Update-Dokumente in `docs/GDD.md` bzw. `docs/ART.md` einarbeiten (Vorgehen wie bei den vorherigen Updates: gleichnamige Abschnitte ersetzen, neue Abschnitte ergänzen). Danach können die beiden Update-Dateien gelöscht werden.

## Umfang

1. **Koloss**: neuer Gegnertyp mit dreistufiger Ankündigung (Warnung, Zielvorhersage mit Live-Neuberechnung bei Verstärkung der vorhergesagten Stelle, fester Auftritt), Durchbruchslogik (gerade Schneise von ca. 5 Feldern in Fahrtrichtung, betroffene Trümmer werden zerstört, Bollwerke widerstehen), danach reguläre Wegfindung und Bewegung. Bastion-Erreichen kostet deutlich mehr Leben als ein normaler Boss. Alle Zahlenwerte (Startwelle, Frequenz, Schneisenlänge, Lebensverlust) als Datenwerte, nicht im Code.
2. **Bollwerk** als neuer Bauwerktyp: aus Trümmern gebaut, blockiert wie Trümmer, übersteht den Koloss-Durchbruch, eigener Preis über dem Abrisspreis.
3. **Kapseln direkt auf Trümmer**: Landezone auf Trümmerfeld erlauben, automatischer Abriss nur bei tatsächlichem Bau dort, sonst keine Kosten.
4. **Neues Kommando Luftschlag**: Linienziel, Flächenschaden, Panzer-Bonus, ab Welle 30, Abklingzeit 4 Wellen, gegen Bosse/Koloss gedeckelt auf 30 % der maximalen Lebenspunkte.
5. **Anpassung bestehender Kommandos**: Orbitalschlag-Radius 2 auf 3 (Bossdeckel gilt jetzt auch für den Koloss), Stasisfeld-Radius 1,5 auf 2,5 (Kurzeinfrieren bei Boss/Koloss bleibt), Priorisierter Nachschub hebt ab Nachschubstufe 6 zwei Ränge statt einem.
6. **Bugfix Sockel-Rendering**: goldener Ring schneidet durch Bauwerke (Tiefensortierung/Höhe), siehe `ART-update-v3.md` Abschnitt 1. Bitte nach der Behebung stichprobenartig mehrere Stellungstypen und Zoomstufen prüfen, der Fehler trat bei mehreren Typen gleichzeitig auf.
7. **Bugfix Abbruchmodus**: Geht während des Abbruchmodus die Requisition auf 0 zur Neige, gibt es aktuell keinen Weg zurück in die normale Planungsphase außer die Salve auszulösen. Der Abbruchmodus muss jederzeit beendbar sein und danach regulär in der Planungsphase weitergehen, unabhängig vom Requisitionsstand.
8. **Ränge als Striche** statt der bisherigen Sternplakette im Auswahldialog, siehe `ART-update-v3.md` Abschnitt 2.
9. **Kapseln kleiner und langsamer**, siehe `ART-update-v3.md` Abschnitt 3.

## Nicht im Umfang
Die vier noch unfertigen Spezialstellungs-Grafiken (weiterhin offen aus M4d). Die Überarbeitung der Waffenaufsätze (noch ohne konkreten Auftrag). Die unbestätigte Idee einer unbegrenzten Nachschubstufe als zusätzliche Requisitions-Senke, siehe GDD-Update-v3 letzter Abschnitt, bewusst nicht Teil dieses Auftrags.

## Hinweise
- Der Koloss ist bewusst so ausgelegt, dass reine Stellungen ihn in der Regel nicht allein stoppen. Bitte nach der Umsetzung kurz zurückmelden, ob sich das beim Testen auch so anfühlt oder ob er zu leicht bzw. zu unfair wirkt, bevor im Balancing-Meilenstein final an den Zahlen gedreht wird.
- Die Zielvorhersage (Stufe 2) muss sich neu berechnen, sobald der Spieler die vorhergesagte Stelle in derselben Planungsphase verstärkt. Bitte kurz prüfen, wie performant das bei größeren Karten ist, da das im schlimmsten Fall bei jeder Bauaktion eine Neuberechnung auslöst.

## Abnahme
- Koloss erscheint, kündigt sich dreistufig an, bricht bei fehlender Verstärkung durch, sonst nicht.
- Bollwerk widersteht dem Durchbruch, normale Trümmer nicht.
- Kapsel-auf-Trümmer-Bau funktioniert wie beschrieben, inklusive korrekter Kostenlogik.
- Luftschlag nutzbar, Linienziel funktioniert auch per Touch.
- Beide gemeldeten Bugs (Sockel-Ring, Abbruchmodus ohne Geld) behoben.
- Ränge als Striche, Kapseln sichtbar kleiner und langsamer fallend.
- Alle bestehenden Unit-Tests weiterhin grün, neue Tests für Wegfindung nach Koloss-Durchbruch und für die Kapsel-auf-Trümmer-Kostenlogik ergänzt.
