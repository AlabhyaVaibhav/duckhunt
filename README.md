# Duck Hunt: Finger Gun

A browser remake of the NES classic. Your webcam watches your hand: point a finger gun at the screen to aim, and drop your thumb like a hammer to shoot.

## Play

https://duckhunt-two.vercel.app, a static Vercel site with no build step. Redeploy with `vercel deploy --prod`.

## Run locally

The camera only works on `localhost` or HTTPS, and the page uses ES modules, so serve the folder:

```sh
python3 serve.py   # no-cache static server on port 8642
# open http://localhost:8642
```

Click **PLAY WITH HAND** and allow camera access. The first load downloads the MediaPipe hand model (~8 MB) from Google's CDN.

## How to shoot

1. Make a finger gun: index finger out, thumb up, other fingers curled.
2. Aim with your index fingertip. The dashed box in the camera preview is the area that maps to the whole screen.
3. Snap your thumb down onto the side of your index finger to fire. Raise it again to re-cock.

The bar under the camera preview shows the thumb position. It has to pass the green line to cock and the orange line to fire. Both lines adapt to your hand: after a few cock-and-fire cycles they settle around your own thumb-up and thumb-down positions. The shot lands where the crosshair was at the moment your thumb started to move. The aim area is `box` in the same file.

The first time you play with your hand, a short **practice** runs before the game: make the finger gun, aim at markers, cock and fire, hit still targets, then hit slow ducks. It shows a live thumb meter with tips as you go. Replay it from **PRACTICE** on the title menu (or `T`); `S` skips a step and `Esc` leaves.

The game goes full screen when you press Play; `F` toggles it.

A corner bar on every screen has **SHARE** (your best score, or an invite if you haven't scored yet; it pauses the game), **TREAT BAILEY** (the UPI chip-in box) and **?** (help). After a game over, a panel offers to share a score card (system share sheet, X, WhatsApp, copy link, or save the image). Shared links end in `?beat=<score>`, so a friend who opens one sees the score to beat on the start panel and title screen.

`support.html` is the help page: setup, camera and tracking fixes, controls, rules, a UPI "Chip in" box, privacy and a progress reset. The UPI QR codes in `assets/qr/` come from `tools/upi_qr.py` (needs `qrcode`); keep its ID and amounts in step with the page.

Mouse and keyboard work too: click to shoot, `Space` fires at the crosshair, `1`/`2` start Game A/B, `P` pauses, `M` mutes, `C` toggles the camera preview.

## Rules (as on the NES)

- **Game A**: one duck at a time. **Game B**: two at a time. 10 ducks per round, 3 shots per appearance.
- Ducks fly away when your shots or time run out (sky turns pink).
- Pass quota: 6 ducks for rounds 1–10, then 7, 8, 9 and finally 10 from round 20.
- Black / blue / red ducks: 500 / 1000 / 1500 points (rising in rounds 6 and 11). Perfect round bonus: 10,000 and up.

Hit boxes are a few pixels more forgiving than the Zapper's, because hand tracking is less precise.

## Code

| File | What |
|---|---|
| `js/hand.js` | MediaPipe Hand Landmarker, 1€ smoothing, finger-gun and hammer detection |
| `js/game.js` | Game state machine, ducks, dog, HUD, title screen |
| `js/sprites.js` | Loads and aligns the sprite PNGs in `assets/` |
| `js/tutorial.js` | Step-by-step finger-gun practice |
| `js/duck.js` | Duck flight (side/diagonal), fly-away, shot and fall |
| `js/draw.js` | Shared drawing helpers and palette |
| `js/scene.js` | Composes tree, bush, grass and dirt |
| `js/audio.js` | Synthesised sound effects and jingles (WebAudio) |
| `js/leaderboard.js` | World top 50 and score submission (Supabase REST) |
| `js/config.js` | Supabase URL and publishable key |
| `js/share.js` | Game-over share panel, score card image, `?beat=` challenge links |
| `js/main.js` | Boot, input, main loop |

## Art credits

- **Dog and ducks:** the original NES *Duck Hunt* sprites (© Nintendo), from a sprite rip supplied for this project. These include the walk, sniff, alert, jump, laugh and holding-ducks poses, and each duck colour's side, diagonal, fly-away, shot and falling frames.
- **Tree, bush, grass, HUD duck icon, title logo:** from the *Super Duck Hunt Supreme Sprite Sheet* (2012) by Shane Toner.
- **Dirt and bullet icon:** drawn in code.

Duck Hunt is a Nintendo trademark. This is a personal, non-commercial fan project and is not affiliated with Nintendo.

To re-cut the sprites (needs Pillow, NumPy, SciPy):

```sh
python3 tools/extract_nes.py path/to/nes_rip.png assets/              # dog + ducks -> assets/nes/, assets/nes.json
python3 tools/segment.py path/to/super_duck_hunt.gif out/              # finds every sprite -> out/boxes.json
python3 tools/extract.py path/to/super_duck_hunt.gif out/boxes.json assets/   # scenery, icon, logo
```

`assets/og.png` is the link-preview image; rebuild it with `python3 tools/og.py . path/to/PressStart2P-Regular.ttf`.

## World leaderboard

After a game over, players can put their score on a world top 50 under a name (up to 10 characters); **TOP 50** in the corner bar shows the board. Each browser gets a random player ID, so a player's runs count as one entry (their best), and a new name renames their entry.

Scores live in Supabase. The browser can only call two database functions, `submit_score` and `leaderboard` (`supabase/migrations/`), which reject scores the real game can't produce: points in steps of 100, at most 60,000 a round, at least 6 ducks per cleared round, and one submission per player every 15 seconds. A determined cheater can still post a plausible fake score, as with any client-side game.

The leaderboard is hidden until `js/config.js` has a project URL and publishable key. To set it up:

```sh
supabase link --project-ref <ref>
supabase db push                      # applies supabase/migrations
supabase projects api-keys --project-ref <ref>   # copy the publishable (or anon) key into js/config.js
```

## Brand assets

`brand/` holds images for the X account (not deployed): `x-avatar-400.png` (profile picture), `x-header-1500x500.png` (banner), and three posts: `x-post-launch-1600x900.png`, `x-post-howto-1600x900.png` and `x-post-shot.gif` (animated). The favicons (`favicon.ico`, `favicon.svg`, `assets/icons/`) use the same mark: the startled black duck on NES sky. All are drawn from the game's sprites, plus a pixel finger-gun hand from `tools/pixelhand.py`. Rebuild them with `python3 tools/brand.py path/to/PressStart2P-Regular.ttf`.

Sound and music are synthesised in code (original tunes).
