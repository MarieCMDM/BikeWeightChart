export const STORAGE_KEY = 'cmdmtech-bike-weight-chart-v1'

const common = [
  ['Telaio', 'frame', 'Telaio'],
  ['Telaio', 'fork', 'Forcella'],
  ['Telaio', 'headset', 'Serie sterzo'],
  ['Telaio', 'spacers', 'Distanziali sterzo'],
  ['Telaio', 'axles', 'Perni passanti'],
  ['Telaio', 'seat-clamp', 'Collarino reggisella'],
  ['Cockpit', 'handlebar', 'Manubrio'],
  ['Cockpit', 'stem', 'Attacco manubrio'],
  ['Sella', 'seatpost', 'Reggisella'],
  ['Sella', 'saddle', 'Sella'],
  ['Trasmissione', 'controls', 'Comandi cambio'],
  ['Trasmissione', 'rear-derailleur', 'Cambio posteriore'],
  ['Trasmissione', 'crankset', 'Guarnitura'],
  ['Trasmissione', 'bottom-bracket', 'Movimento centrale'],
  ['Trasmissione', 'chain', 'Catena'],
  ['Trasmissione', 'cassette', 'Cassetta'],
  ['Trasmissione', 'pedals', 'Pedali'],
  ['Freni', 'brakes', 'Pinze e leve freno'],
  ['Freni', 'rotors', 'Dischi freno'],
  ['Ruote', 'wheels', 'Ruote'],
  ['Ruote', 'tyres', 'Copertoni'],
  ['Ruote', 'tubes-sealant', 'Camere d’aria / lattice'],
  ['Ruote', 'valves', 'Valvole'],
  ['Accessori', 'bottle-cages', 'Portaborraccia'],
  ['Accessori', 'computer-mount', 'Supporto ciclocomputer'],
  ['Accessori', 'hardware', 'Minuteria e altro']
]

const extras = {
  strada: [
    ['Cockpit', 'bar-tape', 'Nastro manubrio'],
    ['Trasmissione', 'front-derailleur', 'Deragliatore anteriore']
  ],
  gravel: [
    ['Cockpit', 'bar-tape', 'Nastro manubrio'],
    ['Trasmissione', 'front-derailleur', 'Deragliatore anteriore'],
    ['Sella', 'dropper-remote', 'Comando reggisella telescopico'],
    ['Accessori', 'frame-protection', 'Protezione telaio']
  ],
  mtb: [
    ['Telaio', 'rear-shock', 'Ammortizzatore posteriore'],
    ['Cockpit', 'grips', 'Manopole'],
    ['Cockpit', 'suspension-remote', 'Comando sospensioni'],
    ['Sella', 'dropper-remote', 'Comando reggisella telescopico'],
    ['Accessori', 'frame-protection', 'Protezione telaio']
  ]
}

export const TEMPLATE_NAMES = { strada: 'Strada', gravel: 'Gravel', mtb: 'MTB' }

export function rowsFor(template) {
  return [...common, ...(extras[template] || [])]
    .map(([category, id, label]) => ({ category, id, label }))
    .sort((a, b) => commonCategoryOrder(a.category) - commonCategoryOrder(b.category))
}

function commonCategoryOrder(category) {
  return ['Telaio', 'Cockpit', 'Sella', 'Trasmissione', 'Freni', 'Ruote', 'Accessori'].indexOf(category)
}

const emptyValue = () => ({ description: '', weightG: 0, priceEur: 0 })

export function createBike(name, template, id = crypto.randomUUID()) {
  return {
    id,
    name: name.trim() || `Bici ${TEMPLATE_NAMES[template]}`,
    template,
    base: Object.fromEntries(rowsFor(template).map(row => [row.id, emptyValue()])),
    alternatives: []
  }
}

export function effectiveValue(bike, alternative, rowId) {
  return alternative?.overrides[rowId] || bike.base[rowId]
}

export function totals(bike, alternative = null) {
  return rowsFor(bike.template).reduce((sum, row) => {
    const value = effectiveValue(bike, alternative, row.id)
    sum.weightG += value.weightG
    sum.priceEur += value.priceEur
    return sum
  }, { weightG: 0, priceEur: 0 })
}

export function differences(bike, alternative) {
  return rowsFor(bike.template).filter(row => {
    const base = bike.base[row.id]
    const value = effectiveValue(bike, alternative, row.id)
    return value.description !== base.description || value.weightG !== base.weightG || value.priceEur !== base.priceEur
  })
}

export function comparison(bike, alternative) {
  const base = totals(bike)
  const current = totals(bike, alternative)
  const changed = differences(bike, alternative)
  const savedG = base.weightG - current.weightG
  const upgradeCost = changed.reduce((sum, row) => sum + effectiveValue(bike, alternative, row.id).priceEur, 0)
  return {
    weightG: current.weightG,
    savedG,
    upgradeCost,
    euroPerGram: savedG > 0 ? upgradeCost / savedG : null,
    changed
  }
}

function validValue(value) {
  return value && typeof value.description === 'string' &&
    Number.isFinite(value.weightG) && value.weightG >= 0 &&
    Number.isFinite(value.priceEur) && value.priceEur >= 0
}

export function isValidBike(bike) {
  if (!bike || typeof bike.id !== 'string' || typeof bike.name !== 'string' || !TEMPLATE_NAMES[bike.template]) return false
  const ids = rowsFor(bike.template).map(row => row.id)
  if (!bike.base || !ids.every(id => validValue(bike.base[id])) || !Array.isArray(bike.alternatives)) return false
  return bike.alternatives.every(alt => alt && typeof alt.id === 'string' && typeof alt.name === 'string' &&
    alt.overrides && Object.entries(alt.overrides).every(([id, value]) => ids.includes(id) && validValue(value)))
}

export function parseBikeFile(text) {
  const data = JSON.parse(text)
  if (data.schemaVersion !== 1 || !isValidBike(data.bike)) throw new Error('Il file non contiene una bici compatibile.')
  return data.bike
}
