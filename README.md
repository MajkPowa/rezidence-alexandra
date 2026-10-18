# Rezidence Alexandra — Otrokovice

Prezentační web rezidenčního projektu s katalogem 51 jednotek, půdorysy, reklamní galerií, filmy, storyboardem a 3D prohlídkami.

Statická publikace pro GitHub Pages. Výchozí stránka je `index.html`; další části jsou `interiors.html`, `creative.html`, `storyboard.html`, `tour.html` a `building.html`. Soubor `.nojekyll` zachovává statické soubory beze změn. Všechny odkazy na lokální média používají relativní cesty.

Galerie interiérů obsahuje 13 pohledů vyrenderovaných z nativních zařízených 3D scén v Blender Cycles. Obývací pokoje, kuchyně, hlavní ložnice a koupelny doplňuje odpočinkový kout 1+kk, který je součástí jediného obytného pokoje. Vychází z dodaných půdorysů a interiérových i koupelnových PDF; zdroj je uveden v detailu každého pohledu. Filtry lze sdílet v URL. Manifest `assets/interiors-v3/manifest.json` odkazuje na responzivní WebP náhledy o šířce 720/2200 px a samostatné soubory `fullResolution` ke stažení v rozlišení 4096 × 2304 px. Nativní scény a PNG originály zůstávají v soukromém pracovním projektu.

Publikační zdroj: větev `main`, kořen repozitáře. Aktualizace této větve automaticky aktualizuje GitHub Pages.

Nové interiérové prohlídky obsahují 19 propojených sférických panoramat v rozlišení 6144 × 3072 px, fyzikálně vyrenderovaných z detailních zařízených 3D modelů (Blender Cycles). Pět stanovišť v 1+kk a po sedmi v 2+kk a 3+kk propojují značky u dveří, seznam místností a interaktivní půdorys. WebGL prohlížeč podporuje dotyk, klávesnici, zoom a celou obrazovku; při nedostupném WebGL zůstávají funkční náhledy místností. Odkaz sdílí zvolený byt a místnost. Galerie umožňuje otevřít příslušnou místnost přímo z detailu renderu.

Dispozice vycházejí z půdorysů bytů 04, 02 a 01. Materiály a nábytek navazují na interiérové podklady a novou galerii; při rozdílu má přednost půdorys. Jde o návrh možného zařízení, nikoli závazný standard. Výhledy jsou ilustrativní. Menší místnost v bytě 01 zůstává komorou s návrhem pracovního místa. Exteriér zůstává zjednodušenou prostorovou studií na `building.html`; obě varianty bočních balkonů jsou označené. Ceník vychází z podkladu k 14. 10. 2026; dostupnost potvrzuje prodejce.

Skenované materiálové textury dubu a látky pocházejí z Poly Haven (CC0); zdroje viz `assets/walkthrough-v3/credits.json`. Originální scény, renderovací skripty a audit geometrie jsou uloženy v soukromém pracovním projektu.

Kontakt na webu připravuje zprávu v e-mailovém programu návštěvníka. Web neukládá kontaktní formuláře na server.

Výběr bytů na hlavní stránce obsahuje prostorové schéma šesti podlaží, přepnutí do půdorysu a 50 ověřených klikacích poloh bytů. Karta vybraného bytu i jeho detail otevírají zařízený 3D půdorys s očíslovanými místnostmi, legendou, zvětšením a přepnutím na původní výkres. Filtry dispozice, plochy, dostupnosti a podlaží jsou společné s tabulkou a porovnáním. Sdílená URL zachová podlaží a číslo bytu (`?podlazi=4&byt=22#byty`). Na telefonu se pro čitelnost nejprve otevře půdorys; prostorový pohled zůstává dostupný.

Deset zařízených dispozičních rodin vychází z půdorysů 01–10 a z porovnání místností ve všech pěti obytných podlažích. Nativní rendery Blender Cycles v rozlišení 4096 × 4096 px používají podrobnější čalounění, fyzikální materiály a skutečné výšky nábytku. Web načítá optimalizované náhledy 2200 × 2200 px a nabízí samostatný plný 4K soubor. `assets/furnished-plans-v2/manifest.json` obsahuje ověřené přiřazení jednotek 1–50, obrázky a polohy značek místností. Návrhy nezahrnují balkony, které se mění podle podlaží; původní výkres a cena vždy patří ke konkrétní vybrané jednotce. Dílčí rozpory kót v podkladech zůstávají k ověření u prodejce. Jednotka 53 má kvůli nepotvrzenému přiřazení nadále původní patrový plán. Při nedostupnosti manifestu se automaticky zobrazí původní výřezy.

Stavy prodeje mají jediný zdroj v `data/availability.js`. Potvrzený stav se zapisuje například jako `units: {"4":"available", "8":"reserved", "15":"sold"}`; toto je pouze ukázka formátu, nikoli skutečný stav uvedených bytů. Chybějící nebo neplatná hodnota vždy znamená „Dostupnost na dotaz“. Současný zdrojový ceník má všechny stavy prázdné, proto aktuální publikace žádný byt neoznačuje jako volný, rezervovaný ani prodaný. Po změně tohoto datového souboru a publikaci se mapa, detail, legenda, filtry i tabulka aktualizují společně. GitHub Pages neposkytuje živé napojení na prodejní systém.

Geometrie v `data/floors.json` vychází z půdorysů jednotlivých podlaží ze 6. 10. 2026. Na 1. NP je v ceníku jednotka 53, zatímco výkres označuje jednotku 51; shoda není potvrzena. Katalog proto ponechává 53 a její polohu v mapě nevybarvuje. Rozsah polygonů představuje bytové bloky bez společné chodby; schéma není stavební dokumentací. Veřejné podklady v `assets/floors/` jsou optimalizované výřezy původních výkresů.

Repozitář obsahuje pouze publikační soubory. Soukromá korespondence, přístupové údaje, API klíče a interní administrativní podklady zde nejsou.
