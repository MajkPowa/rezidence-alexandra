# Rezidence Alexandra — Otrokovice

Prezentační web rezidenčního projektu s katalogem 51 jednotek, půdorysy, reklamní galerií, filmy, storyboardem a 3D prohlídkami.

Statická publikace pro GitHub Pages. Výchozí stránka je `index.html`; další části jsou `interiors.html`, `creative.html`, `storyboard.html`, `tour.html` a `building.html`. Soubor `.nojekyll` zachovává statické soubory beze změn. Všechny odkazy na lokální média používají relativní cesty.

Galerie interiérů obsahuje 12 nových návrhových vizualizací obývacích pokojů, kuchyní, hlavních ložnic a koupelen pro typologie 1+kk, 2+kk a 3+kk. Vychází z dodaných interiérových a koupelnových PDF; zdrojová strana je uvedena v detailu každého obrazu. Filtry lze sdílet v URL. Obrazy vytvořené pomocí Google Gemini 3 Pro Image jsou na webu optimalizované do WebP; originály zůstávají v soukromém pracovním projektu.

Publikační zdroj: větev `main`, kořen repozitáře. Aktualizace této větve automaticky aktualizuje GitHub Pages.

Nové interiérové prohlídky obsahují 19 propojených sférických panoramat v rozlišení 6144 × 3072 px, fyzikálně vyrenderovaných z detailních zařízených 3D modelů (Blender Cycles). Pět stanovišť v 1+kk a po sedmi v 2+kk a 3+kk propojují značky u dveří, seznam místností a interaktivní půdorys. WebGL prohlížeč podporuje dotyk, klávesnici, zoom a celou obrazovku; při nedostupném WebGL zůstávají funkční náhledy místností. Odkaz sdílí zvolený byt a místnost. Galerie umožňuje otevřít příslušnou místnost přímo z detailu renderu.

Dispozice vycházejí z půdorysů bytů 04, 02 a 01. Materiály a nábytek navazují na interiérové podklady a novou galerii; při rozdílu má přednost půdorys. Jde o návrh možného zařízení, nikoli závazný standard. Výhledy jsou ilustrativní. Menší místnost v bytě 01 zůstává komorou s návrhem pracovního místa. Exteriér zůstává zjednodušenou prostorovou studií na `building.html`; obě varianty bočních balkonů jsou označené. Ceník vychází z podkladu k 14. 10. 2026; dostupnost potvrzuje prodejce.

Skenované materiálové textury dubu a látky pocházejí z Poly Haven (CC0); zdroje viz `assets/walkthrough-v3/credits.json`. Originální scény, renderovací skripty a audit geometrie jsou uloženy v soukromém pracovním projektu.

Kontakt na webu připravuje zprávu v e-mailovém programu návštěvníka. Web neukládá kontaktní formuláře na server.

Repozitář obsahuje pouze publikační soubory. Soukromá korespondence, přístupové údaje, API klíče a interní administrativní podklady zde nejsou.
