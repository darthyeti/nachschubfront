# M5: Speichern und PWA

## Ziel
Lokale Bestwerte und Statistiken, Export und Import, installierbare und offline spielbare Web-App.

## Umfang
- Speicherschicht ausbauen: Einstellungen, Bestwerte pro Seed und gesamt, Statistiken (Partien, Siege, Abschüsse, liebste Doktrin).
- Versionierung des gespeicherten Formats mit Migration.
- Export als JSON-Datei und Import mit Prüfung, auch auf dem iPad bedienbar.
- Bestwertliste im Menü.
- Service Worker für Offline-Betrieb mit Cache-Versionierung, damit Updates zuverlässig ankommen.
- Installationshinweis für iPad (Teilen, Zum Home-Bildschirm) und Chrome.
- Schnittstelle der Speicherschicht so dokumentieren, dass später ein Online-Backend für eine Bestenliste ergänzt werden kann.

## Abnahme
- Spiel startet offline nach einmaligem Laden.
- Export und Import funktionieren am Desktop und mit Touch-Emulation.
- Beschädigte oder fremde Importdateien werden sauber abgelehnt.
