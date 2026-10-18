# Rezidence Alexandra — Otrokovice

Prezentační web rezidenčního projektu s katalogem 51 jednotek, půdorysy, reklamní galerií, filmy, storyboardem a 3D prohlídkami.

Statická publikace pro GitHub Pages. Výchozí stránka je `index.html`; další části jsou `interiors.html`, `creative.html`, `storyboard.html`, `tour.html` a `building.html`. Soubor `.nojekyll` zachovává statické soubory beze změn. Všechny odkazy na lokální média používají relativní cesty.

Galerie interiérů obsahuje 12 nových návrhových vizualizací obývacích pokojů, kuchyní, hlavních ložnic a koupelen pro typologie 1+kk, 2+kk a 3+kk. Vychází z dodaných interiérových a koupelnových PDF; zdrojová strana je uvedena v detailu každého obrazu. Filtry lze sdílet v URL. Obrazy vytvořené pomocí Google Gemini 3 Pro Image jsou na webu optimalizované do WebP; originály zůstávají v soukromém pracovním projektu.

Publikační zdroj: větev `main`, kořen repozitáře. Aktualizace této větve automaticky aktualizuje GitHub Pages.

Nové interiérové prohlídky obsahují 19 propojených sférických panoramat v rozlišení 6144 × 3072 px, fyzikálně vyrenderovaných z detailních zařízených 3D modelů (Blender Cycles). Pět stanovišť v 1+kk a po sedmi v 2+kk a 3+kk propojují značky u dveří, seznam místností a interaktivní půdorys. WebGL prohlížeč podporuje dotyk, klávesnici, zoom a celou obrazovku; při nedostupném WebGL zůstávají funkční náhledy místností. Odkaz sdílí zvolený byt a místnost. Galerie umožňuje otevřít příslušnou místnost přímo z detailu renderu.

Dispozice vycházejí z půdorysů bytů 04, 02 a 01. Materiály a nábytek navazují na interiérové podklady a novou galerii; při rozdílu má přednost půdorys. Jde o návrh možného zařízení, nikoli závazný standard. Výhledy jsou ilustrativní. Menší místnost v bytě 01 zůstává komorou s návrhem pracovního místa. Exteriér zůstává zjednodušenou prostorovou studií na `building.html`; obě varianty bočních balkonů jsou označené. Ceník vychází z podkladu k 14. 10. 2026; dostupnost potvrzuje prodejce.

Skenované materiálové textury dubu a látky pocházejí z Poly Haven (CC0); zdroje viz `assets/walkthrough-v3/credits.json`. Originální scény, renderovací skripty a audit geometrie jsou uloženy v soukromém pracovním projektu.

Kontakt na webu připravuje zprávu v e-mailovém programu návštěvníka. Web neukládá kontaktní formuláře na server.

Výběr bytů na hlavní stránce obsahuje prostorové schéma šesti podlaží, přepnutí do půdorysu, 50 ověřených klikacích poloh bytů a detailní výřez každého z nich ze skutečného patrového výkresu. Filtry dispozice, plochy, dostupnosti a podlaží jsou společné s tabulkou a porovnáním. Sdílená URL zachová podlaží a číslo bytu (`?podlazi=4&byt=22#byty`). Na telefonu se pro čitelnost nejprve otevře půdorys; prostorový pohled zůstává dostupný.

Stavy prodeje mají jediný zdroj v `data/availability.js`. Potvrzený stav se zapisuje například jako `units: {"4":"available", "8":"reserved", "15":"sold"}`; toto je pouze ukázka formátu, nikoli skutečný stav uvedených bytů. Chybějící nebo neplatná hodnota vždy znamená „Dostupnost na dotaz“. Současný zdrojový ceník má všechny stavy prázdné, proto aktuální publikace žádný byt neoznačuje jako volný, rezervovaný ani prodaný. Po změně tohoto datového souboru a publikaci se mapa, detail, legenda, filtry i tabulka aktualizují společně. GitHub Pages neposkytuje živé napojení na prodejní systém.

Geometrie v `data/floors.json` vychází z půdorysů jednotlivých podlaží ze 6. 10. 2026. Na 1. NP je v ceníku jednotka 53, zatímco výkres označuje jednotku 51; shoda není potvrzena. Katalog proto ponechává 53 a její polohu v mapě nevybarvuje. Rozsah polygonů představuje bytové bloky bez společné chodby; schéma není stavební dokumentací. Veřejné podklady v `assets/floors/` jsou optimalizované výřezy původních výkresů.

Repozitář obsahuje pouze publikační soubory. Soukromá korespondence, přístupové údaje, API klíče a interní administrativní podklady zde nejsou.
