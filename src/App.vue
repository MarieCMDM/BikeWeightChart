<script setup>
import { computed, ref, watch } from 'vue'
import logo from '../assets/cmdmtech-logo-white.webp'
import {
  STORAGE_KEY, TEMPLATE_NAMES, comparison, createBike, differences,
  effectiveValue, parseBikeFile, rowsFor, totals
} from './data.js'

const saved = (() => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return value?.schemaVersion === 1 && Array.isArray(value.bikes) ? value : null
  } catch { return null }
})()

const bikes = ref(saved?.bikes || [])
const selectedBikeId = ref(saved?.selectedBikeId || bikes.value[0]?.id || null)
const activeView = ref('base')
const compareAltId = ref(null)
const showCreate = ref(false)
const createName = ref('')
const createTemplate = ref('strada')
const notice = ref('')
const fileInput = ref()

const bike = computed(() => bikes.value.find(item => item.id === selectedBikeId.value) || null)
const rows = computed(() => bike.value ? rowsFor(bike.value.template) : [])
const categories = computed(() => [...new Set(rows.value.map(row => row.category))])
const activeAlternative = computed(() => bike.value?.alternatives.find(alt => alt.id === activeView.value) || null)
const comparedAlternative = computed(() => bike.value?.alternatives.find(alt => alt.id === compareAltId.value) || bike.value?.alternatives[0] || null)
const currentTotals = computed(() => bike.value ? totals(bike.value, activeAlternative.value) : { weightG: 0, priceEur: 0 })
const currentComparison = computed(() => bike.value && activeAlternative.value ? comparison(bike.value, activeAlternative.value) : null)
const comparedRows = computed(() => bike.value && comparedAlternative.value ? differences(bike.value, comparedAlternative.value) : [])

watch([bikes, selectedBikeId], () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, selectedBikeId: selectedBikeId.value, bikes: bikes.value }))
}, { deep: true })

watch(bike, current => {
  activeView.value = 'base'
  compareAltId.value = current?.alternatives[0]?.id || null
})

function flash(message) {
  notice.value = message
  window.setTimeout(() => { if (notice.value === message) notice.value = '' }, 2800)
}

function addBike() {
  const created = createBike(createName.value, createTemplate.value)
  bikes.value.push(created)
  selectedBikeId.value = created.id
  createName.value = ''
  showCreate.value = false
}

function removeBike(target) {
  if (!window.confirm(`Eliminare “${target.name}” e tutte le configurazioni?`)) return
  bikes.value = bikes.value.filter(item => item.id !== target.id)
  selectedBikeId.value = bikes.value[0]?.id || null
  showCreate.value = false
}

function addAlternative() {
  const alt = { id: crypto.randomUUID(), name: `Configurazione ${bike.value.alternatives.length + 1}`, overrides: {} }
  bike.value.alternatives.push(alt)
  activeView.value = alt.id
  compareAltId.value = alt.id
}

function removeAlternative() {
  const alt = activeAlternative.value
  if (!alt || !window.confirm(`Eliminare “${alt.name}”?`)) return
  bike.value.alternatives = bike.value.alternatives.filter(item => item.id !== alt.id)
  activeView.value = 'base'
  compareAltId.value = bike.value.alternatives[0]?.id || null
}

function setBase(rowId, field, raw) {
  bike.value.base[rowId][field] = field === 'description' ? raw : Math.max(0, Number(raw) || 0)
}

function setAlternative(rowId, field, raw) {
  const alt = activeAlternative.value
  if (!alt.overrides[rowId]) alt.overrides[rowId] = { ...bike.value.base[rowId] }
  alt.overrides[rowId][field] = field === 'description' ? raw : Math.max(0, Number(raw) || 0)
  const base = bike.value.base[rowId]
  const value = alt.overrides[rowId]
  if (value.description === base.description && value.weightG === base.weightG && value.priceEur === base.priceEur) delete alt.overrides[rowId]
}

function updateValue(rowId, field, event) {
  activeAlternative.value ? setAlternative(rowId, field, event.target.value) : setBase(rowId, field, event.target.value)
}

function resetRow(rowId) {
  delete activeAlternative.value.overrides[rowId]
}

function displayValue(rowId) {
  return effectiveValue(bike.value, activeAlternative.value, rowId)
}

function formatWeight(grams) {
  return grams >= 1000 ? `${(grams / 1000).toLocaleString('it-IT', { maximumFractionDigits: 3 })} kg` : `${grams.toLocaleString('it-IT')} g`
}

function euro(value) {
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

function exportBike() {
  if (!bike.value) return
  const blob = new Blob([JSON.stringify({ schemaVersion: 1, bike: bike.value }, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${bike.value.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'bici'}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function importBike(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  try {
    const imported = parseBikeFile(await file.text())
    const index = bikes.value.findIndex(item => item.id === imported.id)
    if (index >= 0) bikes.value[index] = imported
    else bikes.value.push(imported)
    selectedBikeId.value = imported.id
    flash(index >= 0 ? 'Bici aggiornata dal file.' : 'Bici importata.')
  } catch (error) {
    flash(error instanceof SyntaxError ? 'JSON non valido.' : error.message)
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <img :src="logo" alt="CMDMTECH" />
        <span>Bike Weight Chart</span>
      </div>
      <div class="top-actions">
        <button class="button ghost" @click="fileInput.click()">Importa JSON</button>
        <button class="button ghost" :disabled="!bike" @click="exportBike">Esporta</button>
        <input ref="fileInput" class="visually-hidden" type="file" accept="application/json,.json" @change="importBike" />
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar">
        <div class="sidebar-title">
          <div><span class="eyebrow">Garage</span><strong>Le tue bici</strong></div>
          <button class="icon-button" aria-label="Aggiungi bici" title="Aggiungi bici" @click="showCreate = true">+</button>
        </div>
        <nav aria-label="Archivio biciclette">
          <button v-for="item in bikes" :key="item.id" class="bike-item" :class="{ active: item.id === selectedBikeId }" @click="selectedBikeId = item.id">
            <span class="bike-icon">◇</span>
            <span><strong>{{ item.name }}</strong><small>{{ TEMPLATE_NAMES[item.template] }} · {{ item.alternatives.length }} alternative</small></span>
          </button>
        </nav>
        <div class="sidebar-foot">Salvataggio automatico locale</div>
      </aside>

      <main class="main-content">
        <section v-if="!bike" class="empty-state">
          <div class="empty-mark">◇</div>
          <span class="eyebrow">Il tuo garage è vuoto</span>
          <h1>Costruisci la bici, grammo dopo grammo.</h1>
          <p>Inserisci i componenti, crea alternative e scopri quanto costa davvero alleggerirla.</p>
          <div class="empty-actions">
            <button class="button primary" @click="showCreate = true">Crea la prima bici</button>
            <button class="button ghost" @click="fileInput.click()">Importa un file JSON</button>
          </div>
        </section>

        <template v-else>
          <section class="page-heading">
            <div>
              <span class="eyebrow">{{ TEMPLATE_NAMES[bike.template] }}</span>
              <input v-model.trim="bike.name" class="bike-name" aria-label="Nome bici" />
            </div>
            <button class="button danger subtle" @click="removeBike(bike)">Elimina bici</button>
          </section>

          <div class="tabs" role="tablist" aria-label="Configurazioni">
            <button :class="{ active: activeView === 'base' }" @click="activeView = 'base'">Base</button>
            <button v-for="alt in bike.alternatives" :key="alt.id" :class="{ active: activeView === alt.id }" @click="activeView = alt.id">{{ alt.name }}</button>
            <button class="add-tab" @click="addAlternative">+ Alternativa</button>
            <button :class="{ active: activeView === 'compare' }" @click="activeView = 'compare'">Confronto</button>
          </div>

          <section v-if="activeView !== 'compare'" class="config-view">
            <div class="summary-grid">
              <article class="metric featured"><span>Peso totale</span><strong>{{ formatWeight(currentTotals.weightG) }}</strong></article>
              <article class="metric"><span>Valore componenti</span><strong>{{ euro(currentTotals.priceEur) }}</strong></article>
              <article v-if="currentComparison" class="metric"><span>Peso risparmiato</span><strong :class="{ positive: currentComparison.savedG > 0 }">{{ currentComparison.savedG > 0 ? '−' : currentComparison.savedG < 0 ? '+' : '' }}{{ formatWeight(Math.abs(currentComparison.savedG)) }}</strong></article>
              <article v-if="currentComparison" class="metric"><span>Costo upgrade</span><strong>{{ euro(currentComparison.upgradeCost) }}</strong></article>
            </div>

            <div class="panel">
              <div class="panel-heading">
                <div>
                  <span class="eyebrow">Distinta componenti</span>
                  <input v-if="activeAlternative" v-model.trim="activeAlternative.name" class="config-name" aria-label="Nome configurazione" />
                  <h2 v-else>Configurazione base</h2>
                </div>
                <button v-if="activeAlternative" class="button danger subtle" @click="removeAlternative">Elimina configurazione</button>
              </div>

              <div class="table-wrap">
                <table class="parts-table">
                  <thead><tr><th>Componente</th><th>Marca / modello</th><th>Peso (g)</th><th>Prezzo (€)</th><th><span class="visually-hidden">Azioni</span></th></tr></thead>
                  <tbody v-for="category in categories" :key="category">
                    <tr class="category-row"><th colspan="5">{{ category }}</th></tr>
                    <tr v-for="row in rows.filter(item => item.category === category)" :key="row.id" :class="{ changed: activeAlternative?.overrides[row.id] }">
                      <th scope="row"><span>{{ row.label }}</span><small v-if="activeAlternative && !activeAlternative.overrides[row.id]">Ereditato</small><small v-else-if="activeAlternative">Modificato</small></th>
                      <td><input :value="displayValue(row.id).description" :aria-label="`${row.label}: marca o modello`" placeholder="—" @input="updateValue(row.id, 'description', $event)" /></td>
                      <td><input :value="displayValue(row.id).weightG || ''" :aria-label="`${row.label}: peso in grammi`" type="number" min="0" step="1" placeholder="0" @input="updateValue(row.id, 'weightG', $event)" /></td>
                      <td><input :value="displayValue(row.id).priceEur || ''" :aria-label="`${row.label}: prezzo in euro`" type="number" min="0" step="0.01" placeholder="0,00" @input="updateValue(row.id, 'priceEur', $event)" /></td>
                      <td><button v-if="activeAlternative?.overrides[row.id]" class="reset-button" :aria-label="`Ripristina ${row.label}`" title="Ripristina valore base" @click="resetRow(row.id)">↺</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section v-else class="compare-view">
            <div class="section-heading"><div><span class="eyebrow">Analisi</span><h2>Confronto configurazioni</h2></div></div>
            <div class="comparison-cards">
              <article class="comparison-card base-card"><span class="card-label">Base</span><h3>{{ bike.name }}</h3><strong>{{ formatWeight(totals(bike).weightG) }}</strong><small>Riferimento</small></article>
              <article v-for="alt in bike.alternatives" :key="alt.id" class="comparison-card" :class="{ selected: comparedAlternative?.id === alt.id }" @click="compareAltId = alt.id">
                <span class="card-label">Alternativa</span><h3>{{ alt.name }}</h3><strong>{{ formatWeight(comparison(bike, alt).weightG) }}</strong>
                <small :class="{ positive: comparison(bike, alt).savedG > 0 }">{{ comparison(bike, alt).savedG >= 0 ? '−' : '+' }}{{ formatWeight(Math.abs(comparison(bike, alt).savedG)) }} · {{ euro(comparison(bike, alt).upgradeCost) }}</small>
              </article>
              <button v-if="!bike.alternatives.length" class="empty-alternative" @click="addAlternative">+ Crea un’alternativa</button>
            </div>

            <div v-if="comparedAlternative" class="panel compare-panel">
              <div class="panel-heading">
                <div><span class="eyebrow">Rispetto alla base</span><h2>{{ comparedAlternative.name }}</h2></div>
                <select v-model="compareAltId" aria-label="Configurazione da confrontare">
                  <option v-for="alt in bike.alternatives" :key="alt.id" :value="alt.id">{{ alt.name }}</option>
                </select>
              </div>
              <div class="comparison-summary">
                <div><span>Grammi risparmiati</span><strong>{{ comparison(bike, comparedAlternative).savedG }} g</strong></div>
                <div><span>Costo upgrade</span><strong>{{ euro(comparison(bike, comparedAlternative).upgradeCost) }}</strong></div>
                <div><span>Costo per grammo</span><strong>{{ comparison(bike, comparedAlternative).euroPerGram === null ? '—' : euro(comparison(bike, comparedAlternative).euroPerGram) + '/g' }}</strong></div>
              </div>
              <div v-if="comparedRows.length" class="table-wrap">
                <table class="diff-table">
                  <thead><tr><th>Componente</th><th>Base</th><th>{{ comparedAlternative.name }}</th><th>Differenza</th></tr></thead>
                  <tbody><tr v-for="row in comparedRows" :key="row.id">
                    <th scope="row">{{ row.label }}</th>
                    <td><strong>{{ bike.base[row.id].description || '—' }}</strong><small>{{ bike.base[row.id].weightG }} g · {{ euro(bike.base[row.id].priceEur) }}</small></td>
                    <td><strong>{{ effectiveValue(bike, comparedAlternative, row.id).description || '—' }}</strong><small>{{ effectiveValue(bike, comparedAlternative, row.id).weightG }} g · {{ euro(effectiveValue(bike, comparedAlternative, row.id).priceEur) }}</small></td>
                    <td :class="{ positive: bike.base[row.id].weightG > effectiveValue(bike, comparedAlternative, row.id).weightG }">{{ effectiveValue(bike, comparedAlternative, row.id).weightG - bike.base[row.id].weightG > 0 ? '+' : '' }}{{ effectiveValue(bike, comparedAlternative, row.id).weightG - bike.base[row.id].weightG }} g</td>
                  </tr></tbody>
                </table>
              </div>
              <p v-else class="no-differences">Questa configurazione non ha ancora componenti diversi dalla base.</p>
            </div>
          </section>
        </template>
      </main>
    </div>

    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
      <form class="modal" @submit.prevent="addBike">
        <span class="eyebrow">Nuovo progetto</span><h2>Aggiungi una bici</h2>
        <label>Nome<input v-model="createName" autofocus placeholder="La mia bici" /></label>
        <fieldset><legend>Template</legend><label v-for="(name, id) in TEMPLATE_NAMES" :key="id" class="template-option" :class="{ selected: createTemplate === id }"><input v-model="createTemplate" type="radio" :value="id" /><span><strong>{{ name }}</strong><small>Lista componenti {{ name.toLowerCase() }}</small></span></label></fieldset>
        <div class="modal-actions"><button v-if="bikes.length" type="button" class="button ghost" @click="showCreate = false">Annulla</button><button class="button primary">Crea bici</button></div>
      </form>
    </div>
    <div v-if="notice" class="toast" role="status">{{ notice }}</div>
  </div>
</template>
