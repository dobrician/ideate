# Ideate — analiză cromatică, 4 octombrie 2026

Paletă aprobată de DC și implementată; verificarea și publicarea sunt consemnate în Sprint Log. Urmărire: [#85](https://github.com/dobrician/ideate/issues/85). [Comparație vizuală light/dark](palette-review.html).

## Ce nu funcționează bine acum

- Brandul, acțiunile și mesajele proprii folosesc același verde saturat `#00BC7D`. Chatul concurează vizual cu decizia și voturile.
- Verdele provine din `primary`, `emerald` și `green`; opoziția din `rose` și `red`. Drawerul, voturile și verificarea dublurilor au tratamente diferite pentru aceeași intenție.
- Textul standard `primary-foreground` (`#FAFAFA`) pe verdele actual are contrast măsurat în browser de **2,37:1**. Chatul și unele formulare folosesc text închis separat, ceea ce rezolvă local contrastul, dar lasă sistemul de culori inconsistent.
- Fundalurile chart sunt aceleași culori la 15% opacitate în ambele teme. Rezultatul depinde de suprafața de dedesubt; echilibrul perceput se schimbă între light și dark.
- Roșul viu pentru Contra seamănă cu semnalizarea erorilor/ștergerii. Un vot Contra este o opinie validă, nu o greșeală.

## Direcția recomandată

Păstrăm identitatea verde și charturile din carduri, cu suprafețe mai liniștite, nuanțe calibrate separat pentru fiecare temă și un Contra cărămiziu discret. Saturarea și contrastul puternic apar la acțiunea activă/selectată, nu pe fiecare suprafață. Iconițele, numerele și starea apăsată rămân: rezultatul nu depinde numai de culoare.

| Rol | Light | Dark |
| --- | --- | --- |
| Acțiune de brand | `#216F59`, text `#FFFFFF` | `#75B69A`, text `#102019` |
| Chart Pro | `#E0ECE4` | `#1C3028` |
| Text/selectare Pro | `#246A50` | `#94C9AD` |
| Chart Contra | `#F1E4E0` | `#342626` |
| Text/selectare Contra | `#965447` | `#D7A59C` |
| Mesaj propriu | `#DCEBE3`, text `#19382A` | `#243D31`, text `#DAEBDD` |
| Fundal / card proiect | `#F6F8F5` / `#EAF0E9` | `#121613` / `#202722` |

Contrastul calculat pe combinațiile opace propuse: acțiuni 6,03:1 light / 7,17:1 dark; text Pro pe suprafața Pro 5,32:1 / 7,46:1; text Contra pe suprafața Contra 4,63:1 / 6,72:1. Acestea sunt măsurători ale perechilor propuse, nu o declarație că întregul produs este deja verificat după implementare.

## Integrare aprobată

Folosim tokenuri semantice separate pentru `brand`, `vote-pro`, `vote-contra`, suprafețele chart și chat. Migrarea include butoanele de vot, cardurile, drawerul, modalul de dubluri și mesajele; elimină override-urile dispersate care presupun că verdele principal cere întotdeauna text alb sau întotdeauna text închis. Culorile de eroare/ștergere rămân separate. Păstrăm lățimile și înălțimile charturilor, colțurile rotunjite și fade-ul actual. Verificăm apoi contrastele reale pe straturile compuse, selectarea/hover/focus, teme și mobil.

Comparația HTML este schematică, cu aceeași structură și date fictive în ambele variante; nu este o captură a produsului și nu schimbă datele demo.

## Controlul temei

Schimbarea manuală din meniul contului funcționează în producție, inclusiv trecerea din System/dark în Light. Problema reprodusă este descoperirea controlului după mutarea lui în cont. Fixul readuce butonul soare/lună direct în bara flotantă; limba rămâne în meniul contului. La lățimi sub 360px rămâne simbolul de brand, pentru a păstra trei controale de 44px și linkul Projects fără overflow. Preferința manuală se păstrează la reîncărcare.

## Verificarea implementării

Perechile semantice sunt definite în `src/app/decision-palette.css`; acțiunile și suprafețele neutre rămân în `globals.css`. Testul de browser măsoară culorile efective pentru Pro/Contra selectat și drawer în ambele teme, cu prag de 4,5:1, și păstrează verificarea înălțimii chartului la expandare. Hoverul dark al butonului generic este suprascris explicit pentru a nu transforma umplerea votului în gri semitransparent. Verificarea chatului păstrează testele existente pentru text Markdown și separarea mesajelor primite. Rezultatele regresiei și ale publicării sunt în Sprint Log.
