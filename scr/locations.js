// Named places on the planet, for missions. Keep the ids stable: mission code should refer to places
// by id, e.g. world.locations.find((l) => l.id === 'telaga-biru'), or check world.locationAt(position)
// to see where a character is standing. Each location has a marker point (the pink ring) where a
// mission can start or end.
//
// theta / phi place the site on the sphere: theta is the angle down from the north pole (0 = the main
// town's roundabout, π/2 = the equator, π = the south pole), phi the direction round it (0 = east / +X,
// π/2 = south / +Z, π = west, -π/2 = north). The planet roads run along the equator and the meridians
// phi = 0, π/2, π, -π/2; every site except the main town is a small town built on one of their
// crossroads (its map is in sites.js).
export const LOCATIONS = [
  {
    id: 'alun-alun',
    name: 'Alun-Alun Bintang',
    desc: 'Bundaran tugu di jantung kota, tepat di kutub utara planet.',
    theta: 0,
    phi: 0,
    radius: 14,
  },
  {
    id: 'telaga-biru',
    name: 'Telaga Biru',
    desc: 'Kota danau di khatulistiwa timur: pondok liburan, pasar, dan taman tepi danau.',
    theta: Math.PI / 2,
    phi: 0,
    radius: 40,
  },
  {
    id: 'pondok-pinus',
    name: 'Pondok Pinus',
    desc: 'Bumi perkemahan di hutan pinus, khatulistiwa selatan: tenda, api unggun, dan kolam pancing.',
    theta: Math.PI / 2,
    phi: Math.PI / 2,
    radius: 40,
  },
  {
    id: 'ladang-kincir',
    name: 'Ladang Kincir',
    desc: 'Desa petani di khatulistiwa barat: ladang berkincir angin dan pasar tani.',
    theta: Math.PI / 2,
    phi: Math.PI,
    radius: 40,
  },
  {
    id: 'kilang-awan',
    name: 'Kilang Awan',
    desc: 'Pelabuhan industri di khatulistiwa utara: pabrik, dermaga kontainer, dan parkir truk.',
    theta: Math.PI / 2,
    phi: -Math.PI / 2,
    radius: 40,
  },
  {
    id: 'puncak-salju',
    name: 'Puncak Salju',
    desc: 'Desa salju di kutub selatan: pondok kayu, pasar musim dingin, dikelilingi gunung.',
    theta: Math.PI,
    phi: 0,
    radius: 40,
  },
];
