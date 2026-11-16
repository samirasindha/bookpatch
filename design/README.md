# Logo source

The bookpatch logo is drawn in code so it stays sharp at any size and can follow light/dark mode.

- `make_soft.py` has the drawing helpers (hand-drawn wobble, rounded pickets, grass tufts, strawberries, watering can).
- `make_spines.py` builds the book-spine fence logo and writes `client/src/components/logoArt.ts`.

Edit the helpers, then run `python3 design/make_spines.py` to regenerate. (The scripts also write design-canvas files; those paths only exist on the machine the logo was designed on and can be ignored.)
