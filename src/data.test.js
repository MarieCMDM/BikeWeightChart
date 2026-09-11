import test from 'node:test'
import assert from 'node:assert/strict'
import { comparison, createBike, effectiveValue, parseBikeFile, rowsFor, totals } from './data.js'

test('le alternative ereditano la base e calcolano costo e risparmio', () => {
  const bike = createBike('Test', 'strada', 'bike-1')
  bike.base.frame = { description: 'Base', weightG: 1000, priceEur: 500 }
  bike.base.fork = { description: 'Base', weightG: 500, priceEur: 200 }
  const alternative = { id: 'alt-1', name: 'Light', overrides: {
    frame: { description: 'Carbon', weightG: 800, priceEur: 900 }
  } }

  assert.equal(effectiveValue(bike, alternative, 'fork').weightG, 500)
  assert.deepEqual(totals(bike, alternative), { weightG: 1300, priceEur: 1100 })
  assert.deepEqual(comparison(bike, alternative), {
    weightG: 1300,
    savedG: 200,
    upgradeCost: 900,
    euroPerGram: 4.5,
    changed: [rowsFor('strada').find(row => row.id === 'frame')]
  })

  bike.base.fork.weightG = 400
  assert.equal(totals(bike, alternative).weightG, 1200)
})

test('€/g resta vuoto senza risparmio e il JSON viene validato', () => {
  const bike = createBike('Test', 'mtb', 'bike-2')
  bike.base.frame = { description: 'Base', weightG: 100, priceEur: 10 }
  const alt = { id: 'alt', name: 'Heavy', overrides: {
    frame: { description: 'Heavy', weightG: 120, priceEur: 20 }
  } }
  assert.equal(comparison(bike, alt).euroPerGram, null)
  assert.equal(parseBikeFile(JSON.stringify({ schemaVersion: 1, bike })).id, 'bike-2')
  assert.throws(() => parseBikeFile('{"schemaVersion":1,"bike":{}}'))
})
