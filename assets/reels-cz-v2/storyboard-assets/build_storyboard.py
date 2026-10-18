"""Build the local storyboard from the definitive campaign.json; no network or media edits."""
from pathlib import Path
from html import escape
import json
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WORKSPACE = ROOT.parents[1]
campaign = json.loads((ROOT / 'campaign.json').read_text(encoding='utf-8'))
font_source = WORKSPACE / '07_github_pages' / 'assets' / 'fonts'
(HERE / 'fonts').mkdir(exist_ok=True)
for name in ['inter-normal-latin.woff2', 'inter-normal-latin-ext.woff2', 'playfair-normal-latin.woff2', 'playfair-normal-latin-ext.woff2', 'playfair-italic-latin.woff2', 'playfair-italic-latin-ext.woff2', 'inter-OFL.txt', 'playfairdisplay-OFL.txt']:
    shutil.copyfile(font_source / name, HERE / 'fonts' / name)

E = lambda value: escape(str(value), quote=True)
arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>'
download = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>'
play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>'
labels = {'hero':'Projekt', 'home':'Interiéry', 'architecture':'Architektura', 'bumper6':'Krátká pozvánka'}
intros = {
    'hero':'Od prvního pohledu na dům až k představě vlastního domova. Film propojuje architekturu, tři dispozice a pozvání k prohlídce.',
    'home':'Jeden návrh 2+kk, jeden souvislý příběh. Kuchyně, společné chvíle, ložnice a koupelna v přirozeném tempu běžného dne.',
    'architecture':'Dům v kontextu dodaných podkladů. Detail fasády, vstup a dvě jasně odlišené podoby levé strany.',
    'bumper6':'Šest sekund pro jméno, místo a jednu jasnou akci. Krátká pozvánka využívá záběry domu a interiéru 2+kk.'
}
scene_titles = {
    'H01':'První pohled','H02':'Vítejte doma','H03':'Prostor pro začátek','H04':'Společné chvíle','H05':'Vlastní prostor','H06':'Vaše nová kapitola',
    'D01':'Ranní káva','D02':'U jednoho stolu','D03':'Vlastní tempo','D04':'Večerní rituál','D05':'Čisté linie','D06':'Vstupte dál',
    'A01':'Dům a jeho kontext','A02':'Zblízka i v celku','A03':'Podpis architektury','A04':'Varianta A','A05':'Varianta B','A06':'Vaše perspektiva'
}

def image_button(shot, title, label, extra_class=''):
    return f'''<button class="frame-button {extra_class}" type="button" data-image="image/{E(shot)}.jpg" data-image-title="{E(title)}" data-image-label="{E(label)}" aria-label="Zvětšit klíčový snímek: {E(title)}"><img src="image/{E(shot)}.webp" alt="{E(title)} — {E(label)}" width="720" height="1290" loading="lazy" decoding="async"><span class="frame-expand">{arrow}<span class="sr-only">Zvětšit</span></span></button>'''

films = campaign['reels'] + [campaign['bumper']]
players = []
tabs = []
boards = []
for index, reel in enumerate(films, 1):
    ident, title = reel['id'], reel['title']
    shot = reel['scenes'][0]['shot'] if 'scenes' in reel else reel['shot']
    players.append(f'''<article class="film-card" id="film-{ident}">
      <div class="film-index"><span>0{index} / {labels[ident]}</span><span>{reel['duration']} s</span></div>
      <div class="player-shell" style="--poster:url('image/{E(shot)}.webp')"><video controls playsinline preload="none" poster="posters/{ident}.jpg" data-fallback-poster="image/{E(shot)}.webp" aria-label="{E(title)} — český reklamní film, {reel['duration']} sekund"><source src="reels/{ident}.mp4" type="video/mp4">Váš prohlížeč nepodporuje video. Použijte odkaz ke stažení níže.</video></div>
      <div class="film-copy"><h3>{E(title)}</h3><p class="film-status" role="status" aria-live="polite">Český hlas · vertikální formát</p><button class="retry-film" type="button" hidden>Načíst nový export</button><div class="film-actions"><a href="#storyboard-{ident}" data-open-board="{ident}">Storyboard {arrow}</a><a href="reels/{ident}.mp4" download class="download-film" aria-label="Stáhnout MP4: {E(title)}">Stáhnout {download}</a></div></div>
    </article>''')
    tabs.append(f'<button type="button" role="tab" id="tab-{ident}" aria-controls="storyboard-{ident}" aria-selected="{str(index==1).lower()}" data-tab="{ident}"><span>0{index}</span>{labels[ident]}<small>{reel["duration"]} s</small></button>')
    voice = ' '.join(s['voiceText'] for s in reel['scenes']) if 'scenes' in reel else reel['voiceText']
    cards = []
    if 'scenes' in reel:
        start = 0
        for scene in reel['scenes']:
            end = start + scene['duration']
            label = scene.get('variantLabel') or 'Návrhová AI vizualizace'
            scene_title = scene_titles.get(scene['storyboardId'], scene['storyboardId'])
            variant = ' is-variant' if scene['shot'] in ['exterior-a','exterior-b'] else ''
            is_end = scene['type'] == 'endcard'
            cta = f'<div class="scene-cta"><span>ZÁVĚREČNÁ KARTA</span><strong>{E(reel["cta"]["label"])}</strong></div>' if is_end else ''
            cards.append(f'''<article class="scene-card{variant}" data-storyboard-id="{E(scene['storyboardId'])}">
              <div class="scene-image">{image_button(scene['shot'],scene_title,label)}<span class="scene-duration">{start:02d}–{end:02d} s</span></div>
              <div class="scene-body"><div class="scene-kicker"><span>SCÉNA {E(scene['id'])}</span><span>{E(scene['storyboardId'])}</span></div><h4>{E(scene_title)}</h4><p class="variant-label">{E(label)}</p><div class="voice-block"><span class="micro-label">ČESKÝ HLAS</span><blockquote>{E(scene['voiceText'])}</blockquote></div>{cta}<details class="scene-direction"><summary>Obraz a pohyb<span aria-hidden="true">+</span></summary><div><h5>Obraz</h5><p>{E(scene['visual'])}</p><h5>Pohyb kamery</h5><p>{E(scene['motion'])}</p></div></details></div>
            </article>''')
            start = end
        cta_url = reel['cta']['targetUrl']
        cta_label = reel['cta']['label']
        sequence_note = 'Šest scén po pěti sekundách. Text u každé scény je přesné finální znění českého hlasu.'
    else:
        for n, (shot_id, scene_title, timing, label, motion) in enumerate([
            (reel['shot'],'Jméno a místo','00–03','Návrhová AI vizualizace','Krátký celek domu z hotového klipu; pomalé přiblížení z původního pohledu.'),
            (reel['secondShot'],'Jedno pozvání','03–06','Návrh zařízení · 2+kk','Střih do společného prostoru a čistá závěrečná karta. Poslední okamžik patří názvu a akci.')
        ], 1):
            cards.append(f'''<article class="scene-card bumper-scene"><div class="scene-image">{image_button(shot_id,scene_title,label)}<span class="scene-duration">{timing} s</span></div><div class="scene-body"><div class="scene-kicker"><span>SCÉNA 0{n}</span><span>6s BUMPER</span></div><h4>{scene_title}</h4><p class="variant-label">{label}</p><p class="bumper-motion">{motion}</p><div class="scene-cta"><span>{'ZNAČKA' if n==1 else 'ZÁVĚREČNÁ KARTA'}</span><strong>{'Alexandra · Otrokovice' if n==1 else E(reel['cta'])}</strong></div><p class="voice-continuity">Hlas plyne souvisle přes oba záběry; přesný text je uveden nad storyboardem.</p></div></article>''')
        cta_url='https://majkpowa.github.io/rezidence-alexandra/'
        cta_label=reel['cta']
        sequence_note='Dva záběry po třech sekundách. Jedna souvislá česká hlasová stopa.'
    boards.append(f'''<section class="board-panel" id="storyboard-{ident}" role="tabpanel" aria-labelledby="tab-{ident}" tabindex="0">
      <div class="board-heading"><div><p class="eyebrow">0{index} / {labels[ident].upper()}</p><h3>{E(title)}</h3></div><div><p>{intros[ident]}</p><a class="text-link" href="#film-{ident}">{play} Přejít k filmu</a></div></div>
      <div class="board-meta"><span>{reel['duration']} sekund</span><span>{6 if 'scenes' in reel else 2} scén</span><span>Český hlas</span><span>9:16</span></div>
      <details class="full-script" {'open' if ident=='bumper6' else ''}><summary>Přesný mluvený text<span aria-hidden="true">+</span></summary><div><p class="script-text" id="script-{ident}">{E(voice)}</p><button type="button" class="copy-script" data-copy="script-{ident}">Kopírovat text {download}</button><span class="copy-status" role="status" aria-live="polite"></span></div></details>
      <p class="sequence-note">{sequence_note}</p><div class="scene-grid">{''.join(cards)}</div>
      <div class="board-footer"><div><span class="micro-label">CÍLOVÁ AKCE FILMU</span><p>{E(cta_label)}</p></div><a href="{E(cta_url)}" target="_blank" rel="noopener">Otevřít cílovou stránku {arrow}</a></div>
    </section>''')

html = f'''<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#18392e"><title>Alexandra — Vaše nová kapitola. Zblízka.</title><meta name="description" content="Filmová kolekce Rezidence Alexandra. Tři české třicetisekundové příběhy, šestisekundová pozvánka a podrobné obrazové storyboardy."><link rel="stylesheet" href="storyboard-assets/storyboard.css?v=1"><script src="storyboard-assets/storyboard.js?v=1" defer></script></head>
<body><a class="skip" href="#films">Přejít k filmům</a><header class="site-header"><a class="wordmark" href="#top" aria-label="Alexandra, začátek prezentace">ALEXANDRA<small>REZIDENCE · OTROKOVICE</small></a><nav aria-label="Navigace prezentace"><a href="#films">Filmy</a><a href="#storyboards">Storyboardy</a><a href="#context">Podklady</a></nav><span class="header-edition">FILMOVÁ KOLEKCE / 2026</span></header>
<main id="top"><section class="hero"><div><p class="eyebrow">ALEXANDRA / FILMOVÁ KOLEKCE</p><h1>Vaše nová kapitola.<br><em>Zblízka.</em></h1></div><div class="hero-copy"><span class="gold-line" aria-hidden="true"></span><p>Tři příběhy o domově.<br>Jedno místo pro váš vlastní rytmus.</p><p class="hero-description">Architektura, každodenní život a prostor v detailu. Český hlas, přirozené tempo a obraz postavený na podkladech projektu.</p><a class="hero-link" href="#films">Pustit si příběhy {play}</a></div></section>
<section class="films-section" id="films" aria-labelledby="films-title"><div class="section-heading"><div><p class="eyebrow">01 / FINÁLNÍ FILMY</p><h2 id="films-title">Dívejte se.<br><em>Představujte si.</em></h2></div><div><p>Vyberte si svůj pohled na Alexandru.</p><div class="specs"><span>3 × 30 s</span><span>1 × 6 s</span><span>1080 × 1920</span><span>Česky</span></div></div></div><div class="film-grid">{''.join(players)}</div><p class="player-note">Zvuk spustíte přímo v přehrávači. Pokud export ještě není dostupný, pokračujte ke storyboardu; náhledový snímek zůstává k dispozici.</p></section>
<section class="concept-band" aria-labelledby="concept-title"><p class="eyebrow">JEDEN VIZUÁLNÍ RYTMUS</p><h2 id="concept-title">Od prvního pohledu<br><em>k vlastní představě.</em></h2><div class="concept-points"><div><span>01</span><h3>Architektura</h3><p>Celý dům, jeho výraz a zasazení do prostředí podle dodaného návrhu.</p></div><div><span>02</span><h3>Každodennost</h3><p>Kuchyně, společné chvíle i osobní prostor. Jednoduché situace, které znáte.</p></div><div><span>03</span><h3>Vlastní volba</h3><p>Jasné pozvání k půdorysům, interiérům a prohlídce konkrétní dispozice.</p></div></div></section>
<section class="storyboards-section" id="storyboards" aria-labelledby="boards-title"><div class="section-heading"><div><p class="eyebrow">02 / SCÉNU PO SCÉNĚ</p><h2 id="boards-title">Příběh má<br><em>svou podobu.</em></h2></div><p>Klíčové snímky, přesný český text a pohyb kamery. Kliknutím na obraz si prohlédnete jeho detail.</p></div><div class="story-tabs" role="tablist" aria-label="Vyberte storyboard">{''.join(tabs)}</div>{''.join(boards)}</section>
<section class="context-section" id="context" aria-labelledby="context-title"><div><p class="eyebrow">03 / SOUVISLOSTI</p><h2 id="context-title">Krásná představa.<br><em>Jasný podklad.</em></h2></div><div class="context-copy"><p>Jde o <strong>návrhové AI vizualizace</strong> zpracované podle dodaných obrazových a projektových podkladů. Zobrazené zařízení ilustruje možné uspořádání; konečný standard a rozsah dodávky potvrdí prodejce.</p><p><strong>Reálné okolí nebylo fotografováno.</strong> Ulice, zeleň a sousední budovy jsou převzaté z návrhových vizualizací. Uvádíme město Otrokovice; přesnou adresu a návaznost na okolí potvrdí prodejce.</p><p><strong>Obě varianty balkonů jsou otevřené.</strong> Varianta A ukazuje levou stranu bez bočních balkonů, varianta B s nimi. Jejich konečná podoba není potvrzena.</p><p><strong>Dostupnost bytů je na dotaz.</strong> Tato filmová prezentace neslibuje aktuálně volné jednotky ani termín dokončení.</p><div class="source-links"><a href="campaign.json" download>Scénáře JSON {download}</a><a href="publikacni-texty.txt" download>Texty pro publikaci {download}</a></div></div></section></main>
<footer><a class="wordmark" href="#top">ALEXANDRA<small>REZIDENCE · OTROKOVICE</small></a><p>Vaše nová kapitola. Zblízka.<br><span>Filmová prezentace · návrhové vizualizace</span></p><a class="text-link" href="https://majkpowa.github.io/rezidence-alexandra/" target="_blank" rel="noopener">Prohlédnout projekt {arrow}</a></footer>
<dialog id="frame-dialog" aria-labelledby="frame-title"><div class="dialog-head"><div><span id="frame-label" class="micro-label"></span><h2 id="frame-title"></h2></div><button type="button" id="frame-close" aria-label="Zavřít detail snímku"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><img id="frame-image" alt=""><div class="dialog-foot"><p>Návrhová AI vizualizace podle podkladů projektu.</p><a id="frame-download" download>Stáhnout snímek {download}</a></div></dialog>
</body></html>'''
(ROOT / 'storyboard.html').write_text(html, encoding='utf-8')
print(f'Built storyboard.html from campaign.json: {len(campaign["reels"])} reels + bumper, 20 storyboard frames.')
