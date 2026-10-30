# Zachtlicht

Zachte, gedimde museumkunst in plaats van de screensaver op een geroote LG-tv met webOS 5, 6, 22 of 23. Het beeld wordt klein opgehaald en opgeschaald, met een donkere sluier en een langzame drift, zodat een OLED niet fel blijft staan.

De app vervangt `com.webos.app.screensaver` door een bind-mount op `qml/main.qml`. Dat is hetzelfde aangrijpingspunt als [webosbrew/custom-screensaver](https://github.com/webosbrew/custom-screensaver). webOS 25 en nieuwer gebruiken een andere screensaver en vallen buiten deze versie.

## Wat je nodig hebt

- Een geroote tv met [Homebrew Channel](https://www.webosbrew.org/)
- webOS 5 tot en met 23
- Netwerk, de eerste keer dat de collectie wordt opgehaald

Zonder eerder opgehaalde collectie en zonder netwerk blijft het scherm donker.

## Installeren

### Homebrew Channel

1. Open Homebrew Channel.
2. Open **Settings** en kies **Add repository**.
3. Plak `https://raw.githubusercontent.com/hiddevanbrussel/zachtlicht/main/repo.json`.
4. Ga terug naar de lijst en installeer **Zachtlicht**.
5. Start de app en volg hieronder **Aanzetten**.

De tv moet geroot zijn. Dezelfde URL blijft gelden bij een latere versie: Homebrew Channel leest het manifest van de nieuwste release.

### webOS CLI of Dev Manager

Pakket maken op een computer met de webOS CLI:

```text
npm install -g @webosose/ares-cli
ares-package .
ares-install --device tv org.local.zachtlicht_0.1.1_all.ipk
ares-launch --device tv org.local.zachtlicht
```

`node tools/pack-ipk.js` maakt hetzelfde pakket in `dist/`, plus het manifest voor een release. Of open het `.ipk`-bestand in webOS Dev Manager en kies Install, daarna Launch. De tv staat in de lijst met root-login (`root`, poort 22).

## Aanzetten

1. Zet een andere aangepaste screensaver, zoals Aerial, eerst uit. Twee apps kunnen niet hetzelfde systeembestand overnemen.
2. Open Zachtlicht.
3. Kies **Nu inschakelen** om het meteen te proberen, of **Autostart: uit** zodat het na elke start van de tv terugkomt.
4. Kies **Collectie verversen** als het scherm donker blijft.
5. Kies **Screensaver nu tonen**. Een toets op de afstandsbediening sluit het scherm weer.

**Nu inschakelen** geldt tot de volgende herstart. **Autostart** zet het ook meteen aan en legt een opstartscript in `/var/lib/webosbrew/init.d/50-zachtlicht`. Dat script start `apply.sh` opnieuw na een reboot. Quick Start+ bewaart een mount soms tijdens standby; na een echte herstart doet het opstartscript dat opnieuw.

## Beeld en musea

- **Sluier** dimt het hele beeld. Normaal is een zwarte laag van 45%.
- **Wazigheid** bepaalt hoe klein het bestand wordt opgehaald voordat het schermvullend wordt: licht zacht (960 px), zacht (640 px), heel zacht (320 px).
- **Tijd per werk** is 45 seconden, 90 seconden of 3 minuten. Daarna volgt een kruisovergang van 2 seconden.
- Titel en maker faden kort in en verdwijnen weer.

Standaard komen de werken uit het Metropolitan Museum of Art (Europese schilderijen, publiek domein) en het Art Institute of Chicago. Lukt Chicago niet, dan vult het Metropolitan de collectie. Het Rijksmuseum vraagt een eigen sleutel van alleen letters en cijfers, aan te vragen bij het museum. De sleutel blijft in `/var/lib/webosbrew/zachtlicht/settings.json` op de tv.

## Ongedaan maken

Kies **Ongedaan maken** vóór je de app verwijdert. Dat haalt de mount weg en verwijdert het opstartscript, zodat de LG-screensaver terug is.

Blijft het scherm daarna zwart, dan staat de mount er nog. Via SSH:

```text
umount /usr/palm/applications/com.webos.app.screensaver/qml/main.qml
rm -f /var/lib/webosbrew/init.d/50-zachtlicht
```

## Voorbeeld op de computer

`preview/index.html` toont dezelfde zachte opschaling, sluier, drift en verdwijnende tekst, met werken van het Metropolitan Museum en Chicago. Een werk wisselt daar na 13 seconden, zodat je de overgang kunt zien. Op de tv is de standaard 90 seconden.

De bind-mount en de screensaver-knop werken alleen op de tv.
