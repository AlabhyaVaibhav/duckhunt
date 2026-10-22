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

Sound and music are synthesised in code (original tunes).
