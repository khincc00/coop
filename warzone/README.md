# Mushroom Warzone

Co-op only side-scroller run & gun platformer. Dunia jamur dikudeta pasukan Rebel, dan satu-satunya cara selamat adalah kerja sama. Game ini **tidak bisa dimainkan sendirian**: dua pemain harus menekan tombol siap di title screen, dan setiap zona punya gerbang co-op yang cuma bisa dibuka berdua.

- Teknologi: HTML5 Canvas + vanilla ES modules, tanpa dependency.
- Semua pixel art digambar prosedural di `src/art.js` (palet 16 warna, outline hitam chunky), semua musik & SFX disintesis lewat WebAudio di `src/audio.js`. Tidak ada file aset eksternal.
- Resolusi internal 480x270, di-scale integer ke layar (pixel tetap tajam).

## Cara main

```bash
npm install
npm run dev
# buka http://localhost:5173/warzone/
```

Atau sajikan folder `warzone/` dengan static server apa saja (misalnya `python3 -m http.server`), karena game ini tidak butuh build.

## Kontrol (1 keyboard, 2 pemain, atau 2 gamepad)

| Aksi | P1 PLUMBER | P2 GUNNER |
| --- | --- | --- |
| Jalan | A / D | Panah kiri / kanan |
| Lompat | W / Space | J (tahan di udara = jetpack) |
| Atas / bawah | W / S | Panah atas (aim) / bawah (jongkok) |
| Ground pound / masuk pipa | S (di udara / di atas pipa) | - |
| Tembak | - | K |
| Granat | - | L (3 koin = 1 granat) |
| Aksi (tuas, valve, revive, angkat, tank) | F | I |
| Ultimate | G: Star Power 8 dtk | O: SV-001 Tank Call 15 dtk |

Lainnya: P / Esc = pause, M = mute, 1/2/3 di title = pilih zona awal. Gamepad 1 = P1, gamepad 2 = P2.

## Desain

### Karakter asimetris
- **PLUMBER**: lompatan 1.5x Gunner, wall cling 3 detik + wall jump, ground pound (hancurkan lantai rapuh, stun musuh sekitar), masuk pipa, stomp = kill, ultimate Star Power.
- **GUNNER**: Heavy Pistol infinite, ammo terbatas untuk HMG / Shotgun / Rocket / Flame, jetpack hover 2.5 detik, craft granat dari koin, satu-satunya yang bisa menghancurkan Tembok Baja & Sandbag, bisa mengangkat dan melempar Plumber, ultimate memanggil tank SV-001.

### Co-op puzzle
- **POGO CANNON**: Plumber berdiri di kepala Gunner, Gunner jongkok + tembak ke bawah, Plumber terpental tinggi.
- **SEE-SAW MORTAR**: Gunner berdiri di ujung jungkat-jungkit, Plumber ground pound ujung satunya, Gunner terpental lalu menembak saklar di langit.
- **PIPE-SYNC**: Plumber masuk pipa dan memutar valve dari dalam, Gunner menahan gerombolan musuh 15-20 detik.
- **TANK BRIDGE**: Gunner mengendarai SV-001 ke tepi jurang dan memanjangkan moncong, Plumber berjalan di moncong untuk menyeberang dan menarik tuas jembatan.
- Bonus: carry + jetpack menyeberangi lantai duri, pelat tekan bergantian, boost dari kepala teman.

### Revive & nyawa
Pemain yang tumbang masuk gelembung selama 15 detik. Gunner menembak gelembung Plumber untuk menghidupkannya, Plumber menginjak gelembung Gunner (atau tahan F di dekatnya). Kalau dua-duanya tumbang, satu nyawa hilang. Menyelamatkan POW memberi nyawa tambahan.

### Zona
1. **Mushroom Trenches**: tutorial co-op, banyak pipa, Rebel Goomba. Boss: Piranha Tank.
2. **Pipe Factory Siege**: menara vertikal, banyak tembok baja. Boss: Mecha Lakitu Gunship.
3. **POW Sky Fortress**: semua puzzle digabung, jurang tanpa dasar. Boss: Bowser Slug.

### Kamera
Satu layar selama kedua pemain berdekatan, lalu otomatis split-screen (horizontal atau vertikal) saat terpisah jauh, dan menyatu lagi saat mendekat.

## Struktur kode

```
warzone/
  index.html
  src/
    main.js     loop fixed-step 60 Hz, scaling, hook testing
    input.js    keyboard + gamepad untuk 2 pemain
    audio.js    musik chiptune & SFX WebAudio
    art.js      semua sprite, tile, FX, background prosedural
    levels.js   layout 3 zona (tile map + objek)
    world.js    tile map & collision
    players.js  Plumber & Gunner
    enemies.js  6 musuh + 3 boss
    game.js     state game, puzzle, kamera split-screen, tank SV-001
    render.js   render dunia + HUD
```

Hook untuk testing otomatis: `window.render_game_to_text()`, `window.advanceTime(ms)`.

## Prompt pack (untuk ganti ke aset AI nanti)

Global style: `16-bit SNES x NEO GEO pixel art, chunky black outline 2px, limited 16 colors palette, vibrant military green + mushroom red`. Semua sprite prosedural di `src/art.js` memakai palet yang sama (`PAL`), jadi aset hasil generate bisa menggantikan fungsi sprite satu per satu tanpa mengubah gameplay.
